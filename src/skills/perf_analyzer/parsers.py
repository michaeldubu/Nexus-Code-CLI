"""
Performance benchmark parsers for various output formats.
Handles CUDA, CPU, memory, and custom benchmark formats.
"""

import re
import json
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class BenchmarkResult:
    """Structured benchmark result."""
    name: str
    metric_type: str  # 'GFLOPS', 'TFLOPS', 'ms', 'GB/s', etc.
    value: float
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __repr__(self):
        return f"{self.name}: {self.value:.2f} {self.metric_type}"


@dataclass
class BenchmarkSuite:
    """Collection of benchmark results."""
    name: str
    results: List[BenchmarkResult]
    timestamp: datetime = field(default_factory=datetime.now)
    config: Dict[str, Any] = field(default_factory=dict)
    
    def get_metric(self, name: str) -> Optional[BenchmarkResult]:
        """Get a specific benchmark result by name."""
        for result in self.results:
            if result.name == name:
                return result
        return None
    
    def get_all_metrics(self, metric_type: str) -> List[BenchmarkResult]:
        """Get all results of a specific metric type."""
        return [r for r in self.results if r.metric_type == metric_type]


class CUDABenchmarkParser:
    """Parser for CUDA benchmark output."""
    
    @staticmethod
    def parse(text: str) -> BenchmarkSuite:
        """
        Parse CUDA benchmark output.
        
        Expected format examples:
        - "CUDA: 2939.45 GFLOPS (2.939 TFLOPS)"
        - "Best time: 46.76ms"
        - "Benchmarking 4096x4096 matrices..."
        """
        results = []
        current_config = {}
        
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Parse matrix size
            matrix_match = re.search(r'Benchmarking (\d+)x(\d+)', line)
            if matrix_match:
                size = int(matrix_match.group(1))
                current_config['matrix_size'] = size
                current_config['matrix_dims'] = f"{size}x{size}"
                continue
            
            # Parse execution time
            time_match = re.search(r'Best time:\s*([\d.]+)ms', line)
            if time_match:
                time_ms = float(time_match.group(1))
                results.append(BenchmarkResult(
                    name=f"Execution Time ({current_config.get('matrix_dims', 'unknown')})",
                    metric_type='ms',
                    value=time_ms,
                    metadata=current_config.copy()
                ))
                continue
            
            # Parse CUDA GFLOPS/TFLOPS
            cuda_match = re.search(r'CUDA:\s*([\d.]+)\s*GFLOPS\s*\(([\d.]+)\s*TFLOPS\)', line)
            if cuda_match:
                gflops = float(cuda_match.group(1))
                tflops = float(cuda_match.group(2))
                
                results.append(BenchmarkResult(
                    name=f"CUDA Performance ({current_config.get('matrix_dims', 'unknown')})",
                    metric_type='GFLOPS',
                    value=gflops,
                    metadata=current_config.copy()
                ))
                
                results.append(BenchmarkResult(
                    name=f"CUDA Performance ({current_config.get('matrix_dims', 'unknown')})",
                    metric_type='TFLOPS',
                    value=tflops,
                    metadata=current_config.copy()
                ))
                continue
            
            # Parse CPU GFLOPS
            cpu_match = re.search(r'CPU:\s*([\d.]+)\s*GFLOPS', line)
            if cpu_match:
                gflops = float(cpu_match.group(1))
                results.append(BenchmarkResult(
                    name=f"CPU Performance ({current_config.get('matrix_dims', 'unknown')})",
                    metric_type='GFLOPS',
                    value=gflops,
                    metadata=current_config.copy()
                ))
                continue
        
        return BenchmarkSuite(
            name="CUDA Benchmark Suite",
            results=results,
            config=current_config
        )


class GenericBenchmarkParser:
    """Parser for generic benchmark formats (CSV, JSON, key-value)."""
    
    @staticmethod
    def parse_csv(text: str) -> BenchmarkSuite:
        """Parse CSV format benchmark data."""
        results = []
        lines = text.strip().split('\n')
        
        if len(lines) < 2:
            return BenchmarkSuite(name="CSV Benchmark", results=[])
        
        # Parse header
        headers = [h.strip() for h in lines[0].split(',')]
        
        # Parse data rows
        for line in lines[1:]:
            if not line.strip():
                continue
                
            values = [v.strip() for v in line.split(',')]
            
            if len(values) != len(headers):
                continue
            
            # Assume first column is name, others are metrics
            name = values[0]
            for i, header in enumerate(headers[1:], 1):
                try:
                    value = float(values[i])
                    results.append(BenchmarkResult(
                        name=name,
                        metric_type=header,
                        value=value
                    ))
                except ValueError:
                    # Skip non-numeric values
                    pass
        
        return BenchmarkSuite(name="CSV Benchmark Suite", results=results)
    
    @staticmethod
    def parse_json(text: str) -> BenchmarkSuite:
        """Parse JSON format benchmark data."""
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return BenchmarkSuite(name="JSON Benchmark", results=[])
        
        results = []
        
        # Handle array of results
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    name = item.get('name', 'Unknown')
                    for key, value in item.items():
                        if key != 'name' and isinstance(value, (int, float)):
                            results.append(BenchmarkResult(
                                name=name,
                                metric_type=key,
                                value=float(value)
                            ))
        
        # Handle nested structure
        elif isinstance(data, dict):
            for name, metrics in data.items():
                if isinstance(metrics, dict):
                    for metric_name, value in metrics.items():
                        if isinstance(value, (int, float)):
                            results.append(BenchmarkResult(
                                name=name,
                                metric_type=metric_name,
                                value=float(value)
                            ))
                elif isinstance(metrics, (int, float)):
                    results.append(BenchmarkResult(
                        name=name,
                        metric_type='value',
                        value=float(metrics)
                    ))
        
        return BenchmarkSuite(name="JSON Benchmark Suite", results=results)
    
    @staticmethod
    def parse_key_value(text: str) -> BenchmarkSuite:
        """Parse key-value format (key: value or key = value)."""
        results = []
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Try colon separator
            if ':' in line:
                parts = line.split(':', 1)
                key = parts[0].strip()
                value_str = parts[1].strip()
            # Try equals separator
            elif '=' in line:
                parts = line.split('=', 1)
                key = parts[0].strip()
                value_str = parts[1].strip()
            else:
                continue
            
            # Extract numeric value and unit
            match = re.search(r'([\d.]+)\s*([A-Za-z/]+)?', value_str)
            if match:
                value = float(match.group(1))
                unit = match.group(2) if match.group(2) else 'value'
                
                results.append(BenchmarkResult(
                    name=key,
                    metric_type=unit,
                    value=value
                ))
        
        return BenchmarkSuite(name="Key-Value Benchmark Suite", results=results)


class BenchmarkParserFactory:
    """Factory to automatically detect and parse benchmark formats."""
    
    @staticmethod
    def parse(text: str, format_hint: Optional[str] = None) -> BenchmarkSuite:
        """
        Automatically detect format and parse benchmark data.
        
        Args:
            text: Raw benchmark output
            format_hint: Optional hint about format ('cuda', 'csv', 'json', 'kv')
        
        Returns:
            Parsed BenchmarkSuite
        """
        if not text or not text.strip():
            return BenchmarkSuite(name="Empty Benchmark", results=[])
        
        text = text.strip()
        
        # Use hint if provided
        if format_hint:
            format_hint = format_hint.lower()
            if format_hint in ['cuda', 'gpu']:
                return CUDABenchmarkParser.parse(text)
            elif format_hint == 'csv':
                return GenericBenchmarkParser.parse_csv(text)
            elif format_hint == 'json':
                return GenericBenchmarkParser.parse_json(text)
            elif format_hint in ['kv', 'keyvalue']:
                return GenericBenchmarkParser.parse_key_value(text)
        
        # Auto-detect format
        
        # Check for JSON
        if text.startswith('{') or text.startswith('['):
            try:
                json.loads(text)
                return GenericBenchmarkParser.parse_json(text)
            except json.JSONDecodeError:
                pass
        
        # Check for CUDA patterns
        if 'CUDA' in text or 'GFLOPS' in text or 'TFLOPS' in text:
            return CUDABenchmarkParser.parse(text)
        
        # Check for CSV (comma-separated with header)
        lines = text.split('\n')
        if len(lines) >= 2 and ',' in lines[0]:
            first_line_parts = lines[0].split(',')
            if len(first_line_parts) > 1:
                return GenericBenchmarkParser.parse_csv(text)
        
        # Default to key-value
        return GenericBenchmarkParser.parse_key_value(text)


# Convenience function for quick parsing
def parse_benchmark(text: str, format_hint: Optional[str] = None) -> BenchmarkSuite:
    """Quick parse function for benchmark data."""
    return BenchmarkParserFactory.parse(text, format_hint)
