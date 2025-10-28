"""
Core performance analysis engine.
Statistical analysis, trend detection, bottleneck identification, and optimization recommendations.
"""

import statistics
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import math

from parsers import BenchmarkResult, BenchmarkSuite


@dataclass
class PerformanceMetrics:
    """Statistical metrics for a set of benchmark results."""
    mean: float
    median: float
    std_dev: float
    min_val: float
    max_val: float
    percentile_25: float
    percentile_75: float
    percentile_95: float
    coefficient_of_variation: float  # std_dev / mean
    
    def __repr__(self):
        return (f"Mean: {self.mean:.2f}, Median: {self.median:.2f}, "
                f"StdDev: {self.std_dev:.2f}, CV: {self.coefficient_of_variation:.2%}")


@dataclass
class ComparisonResult:
    """Result of comparing two benchmark runs."""
    baseline_name: str
    comparison_name: str
    metric_type: str
    baseline_value: float
    comparison_value: float
    absolute_diff: float
    percent_change: float
    speedup: float
    is_improvement: bool
    is_regression: bool
    
    def __repr__(self):
        direction = "↑" if self.is_improvement else "↓" if self.is_regression else "→"
        return (f"{self.metric_type}: {self.baseline_value:.2f} → {self.comparison_value:.2f} "
                f"({direction} {self.percent_change:+.1f}%, {self.speedup:.2f}x)")


@dataclass
class Bottleneck:
    """Identified performance bottleneck."""
    component: str
    severity: str  # 'critical', 'high', 'medium', 'low'
    description: str
    impact: float  # estimated performance impact
    recommendations: List[str]


@dataclass
class AnalysisReport:
    """Complete analysis report."""
    suite_name: str
    timestamp: datetime
    metrics: Dict[str, PerformanceMetrics]
    comparisons: List[ComparisonResult]
    bottlenecks: List[Bottleneck]
    recommendations: List[str]
    summary: str
    raw_results: List[BenchmarkResult]


class PerformanceAnalyzer:
    """Core performance analysis engine."""
    
    def __init__(self):
        self.history: List[BenchmarkSuite] = []
    
    def add_to_history(self, suite: BenchmarkSuite):
        """Add benchmark suite to historical tracking."""
        self.history.append(suite)
    
    @staticmethod
    def calculate_metrics(values: List[float]) -> PerformanceMetrics:
        """Calculate statistical metrics for a list of values."""
        if not values:
            raise ValueError("Cannot calculate metrics for empty list")
        
        sorted_vals = sorted(values)
        n = len(sorted_vals)
        
        mean_val = statistics.mean(values)
        median_val = statistics.median(values)
        std_dev_val = statistics.stdev(values) if n > 1 else 0.0
        
        # Percentiles
        p25_idx = int(n * 0.25)
        p75_idx = int(n * 0.75)
        p95_idx = int(n * 0.95)
        
        return PerformanceMetrics(
            mean=mean_val,
            median=median_val,
            std_dev=std_dev_val,
            min_val=min(values),
            max_val=max(values),
            percentile_25=sorted_vals[p25_idx],
            percentile_75=sorted_vals[p75_idx],
            percentile_95=sorted_vals[p95_idx],
            coefficient_of_variation=std_dev_val / mean_val if mean_val != 0 else 0.0
        )
    
    @staticmethod
    def compare_results(baseline: BenchmarkResult, 
                       comparison: BenchmarkResult) -> ComparisonResult:
        """Compare two benchmark results."""
        if baseline.metric_type != comparison.metric_type:
            raise ValueError("Cannot compare results with different metric types")
        
        absolute_diff = comparison.value - baseline.value
        percent_change = (absolute_diff / baseline.value * 100) if baseline.value != 0 else 0.0
        
        # For timing metrics (ms), lower is better
        # For throughput metrics (GFLOPS, TFLOPS, GB/s), higher is better
        timing_metrics = ['ms', 'seconds', 's', 'time']
        is_timing = any(tm in baseline.metric_type.lower() for tm in timing_metrics)
        
        if is_timing:
            # Lower is better for timing
            speedup = baseline.value / comparison.value if comparison.value != 0 else 0.0
            is_improvement = comparison.value < baseline.value
            is_regression = comparison.value > baseline.value * 1.05  # >5% slower
        else:
            # Higher is better for throughput
            speedup = comparison.value / baseline.value if baseline.value != 0 else 0.0
            is_improvement = comparison.value > baseline.value
            is_regression = comparison.value < baseline.value * 0.95  # >5% slower
        
        return ComparisonResult(
            baseline_name=baseline.name,
            comparison_name=comparison.name,
            metric_type=baseline.metric_type,
            baseline_value=baseline.value,
            comparison_value=comparison.value,
            absolute_diff=absolute_diff,
            percent_change=percent_change,
            speedup=speedup,
            is_improvement=is_improvement,
            is_regression=is_regression
        )
    
    def identify_bottlenecks(self, suite: BenchmarkSuite) -> List[Bottleneck]:
        """Identify performance bottlenecks in benchmark suite."""
        bottlenecks = []
        
        # Get CUDA vs CPU performance
        cuda_results = [r for r in suite.results if 'CUDA' in r.name and r.metric_type == 'GFLOPS']
        cpu_results = [r for r in suite.results if 'CPU' in r.name and r.metric_type == 'GFLOPS']
        
        if cuda_results and cpu_results:
            # Calculate average speedup
            speedups = []
            for cuda_res, cpu_res in zip(cuda_results, cpu_results):
                if cpu_res.value > 0:
                    speedups.append(cuda_res.value / cpu_res.value)
            
            if speedups:
                avg_speedup = statistics.mean(speedups)
                
                # Expected GPU speedup is typically 10-100x for well-optimized code
                if avg_speedup < 10:
                    bottlenecks.append(Bottleneck(
                        component="GPU Utilization",
                        severity="critical" if avg_speedup < 5 else "high",
                        description=f"GPU speedup is only {avg_speedup:.1f}x over CPU (expected 10-100x)",
                        impact=100 - (avg_speedup / 10 * 100),
                        recommendations=[
                            "Check for memory transfer bottlenecks between host and device",
                            "Verify kernel launch configurations (grid/block dimensions)",
                            "Profile memory access patterns - ensure coalesced access",
                            "Consider using shared memory for frequently accessed data",
                            "Check for thread divergence in kernel code"
                        ]
                    ))
        
        # Check for execution time variance
        time_results = [r for r in suite.results if r.metric_type == 'ms']
        if time_results:
            for result in time_results:
                # If we have multiple runs, check variance
                if result.metadata.get('runs'):
                    times = result.metadata['runs']
                    if len(times) > 1:
                        cv = statistics.stdev(times) / statistics.mean(times)
                        if cv > 0.1:  # >10% coefficient of variation
                            bottlenecks.append(Bottleneck(
                                component=result.name,
                                severity="medium",
                                description=f"High timing variance (CV: {cv:.1%})",
                                impact=cv * 100,
                                recommendations=[
                                    "Check for thermal throttling",
                                    "Verify no background processes interfering",
                                    "Consider running more warmup iterations",
                                    "Check for GPU frequency scaling"
                                ]
                            ))
        
        # Check memory bandwidth efficiency
        bandwidth_results = [r for r in suite.results if 'GB/s' in r.metric_type]
        if bandwidth_results:
            for result in bandwidth_results:
                # Theoretical max for common GPUs is ~900 GB/s (A100), ~1555 GB/s (H100)
                # If we're getting less than 60% of theoretical, flag it
                if result.value < 500:  # Conservative threshold
                    efficiency = (result.value / 900) * 100  # Assuming A100-class GPU
                    if efficiency < 60:
                        bottlenecks.append(Bottleneck(
                            component="Memory Bandwidth",
                            severity="high" if efficiency < 40 else "medium",
                            description=f"Memory bandwidth at {efficiency:.1f}% of theoretical peak",
                            impact=100 - efficiency,
                            recommendations=[
                                "Optimize memory access patterns for coalescing",
                                "Reduce memory traffic with shared memory",
                                "Check for unnecessary data transfers",
                                "Consider data layout transformations (AoS vs SoA)"
                            ]
                        ))
        
        return sorted(bottlenecks, key=lambda b: b.impact, reverse=True)
    
    def generate_recommendations(self, suite: BenchmarkSuite, 
                                bottlenecks: List[Bottleneck]) -> List[str]:
        """Generate actionable optimization recommendations."""
        recommendations = []
        
        # General recommendations based on results
        cuda_results = [r for r in suite.results if 'CUDA' in r.name and r.metric_type == 'TFLOPS']
        if cuda_results:
            max_tflops = max(r.value for r in cuda_results)
            
            # A100 theoretical peak: ~19.5 TFLOPS (FP32), ~312 TFLOPS (TF32)
            # H100 theoretical peak: ~51 TFLOPS (FP32), ~989 TFLOPS (TF32)
            if max_tflops < 15:  # Below high-end consumer GPU performance
                recommendations.append(
                    "Performance is below expected levels for modern GPUs. "
                    "Consider profiling with nsight compute to identify specific bottlenecks."
                )
        
        # Add bottleneck-specific recommendations
        if bottlenecks:
            critical_bottlenecks = [b for b in bottlenecks if b.severity == 'critical']
            if critical_bottlenecks:
                recommendations.append(
                    f"Critical issue: {critical_bottlenecks[0].description}. "
                    "This should be the top optimization priority."
                )
        
        # Matrix size specific recommendations
        matrix_sizes = set()
        for result in suite.results:
            if 'matrix_size' in result.metadata:
                matrix_sizes.add(result.metadata['matrix_size'])
        
        if matrix_sizes:
            max_size = max(matrix_sizes)
            if max_size >= 8192:
                recommendations.append(
                    "Large matrix sizes detected. Consider tiling strategies "
                    "or hierarchical algorithms for better cache utilization."
                )
        
        return recommendations
    
    def analyze(self, suite: BenchmarkSuite) -> AnalysisReport:
        """Perform complete analysis of benchmark suite."""
        # Calculate metrics for each metric type
        metrics_by_type = {}
        for metric_type in set(r.metric_type for r in suite.results):
            values = [r.value for r in suite.results if r.metric_type == metric_type]
            if values:
                metrics_by_type[metric_type] = self.calculate_metrics(values)
        
        # Identify bottlenecks
        bottlenecks = self.identify_bottlenecks(suite)
        
        # Generate recommendations
        recommendations = self.generate_recommendations(suite, bottlenecks)
        
        # Compare with historical data if available
        comparisons = []
        if len(self.history) >= 1:
            prev_suite = self.history[-1]
            
            # Match results by name and type
            for result in suite.results:
                prev_result = prev_suite.get_metric(result.name)
                if prev_result and prev_result.metric_type == result.metric_type:
                    comparison = self.compare_results(prev_result, result)
                    comparisons.append(comparison)
        
        # Generate summary
        summary_parts = []
        if suite.results:
            summary_parts.append(f"Analyzed {len(suite.results)} benchmark results.")
        
        if bottlenecks:
            critical_count = sum(1 for b in bottlenecks if b.severity == 'critical')
            high_count = sum(1 for b in bottlenecks if b.severity == 'high')
            if critical_count:
                summary_parts.append(f"Found {critical_count} critical bottleneck(s).")
            if high_count:
                summary_parts.append(f"Found {high_count} high-priority issue(s).")
        
        if comparisons:
            improvements = sum(1 for c in comparisons if c.is_improvement)
            regressions = sum(1 for c in comparisons if c.is_regression)
            if improvements:
                summary_parts.append(f"{improvements} metric(s) improved vs previous run.")
            if regressions:
                summary_parts.append(f"⚠️  {regressions} metric(s) regressed vs previous run.")
        
        summary = " ".join(summary_parts) if summary_parts else "Benchmark analysis complete."
        
        # Add to history for future comparisons
        self.add_to_history(suite)
        
        return AnalysisReport(
            suite_name=suite.name,
            timestamp=datetime.now(),
            metrics=metrics_by_type,
            comparisons=comparisons,
            bottlenecks=bottlenecks,
            recommendations=recommendations,
            summary=summary,
            raw_results=suite.results
        )


def analyze_benchmark(suite: BenchmarkSuite, 
                      analyzer: Optional[PerformanceAnalyzer] = None) -> AnalysisReport:
    """Quick function to analyze a benchmark suite."""
    if analyzer is None:
        analyzer = PerformanceAnalyzer()
    return analyzer.analyze(suite)
