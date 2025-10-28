"""
Data formatting utilities for professional report presentation.
Smart formatters that adapt to audience and context.
"""

from typing import Union, List, Dict, Any, Optional
from datetime import datetime, timedelta
import statistics


class MetricFormatter:
    """Smart metric formatting with automatic unit scaling."""
    
    @staticmethod
    def format_number(value: float, 
                     precision: int = 2,
                     use_suffix: bool = True) -> str:
        """
        Format number with appropriate suffix (K, M, B, T).
        
        Args:
            value: Number to format
            precision: Decimal places
            use_suffix: Whether to use K/M/B/T suffixes
        
        Returns:
            Formatted string
        """
        if not use_suffix:
            return f"{value:,.{precision}f}"
        
        abs_value = abs(value)
        sign = '-' if value < 0 else ''
        
        if abs_value >= 1e12:
            return f"{sign}{abs_value/1e12:.{precision}f}T"
        elif abs_value >= 1e9:
            return f"{sign}{abs_value/1e9:.{precision}f}B"
        elif abs_value >= 1e6:
            return f"{sign}{abs_value/1e6:.{precision}f}M"
        elif abs_value >= 1e3:
            return f"{sign}{abs_value/1e3:.{precision}f}K"
        else:
            return f"{sign}{abs_value:.{precision}f}"
    
    @staticmethod
    def format_percentage(value: float, 
                         precision: int = 1,
                         show_sign: bool = True) -> str:
        """
        Format percentage value.
        
        Args:
            value: Percentage value (e.g., 15.5 for 15.5%)
            precision: Decimal places
            show_sign: Whether to show + for positive values
        
        Returns:
            Formatted percentage string
        """
        if show_sign and value > 0:
            return f"+{value:.{precision}f}%"
        return f"{value:.{precision}f}%"
    
    @staticmethod
    def format_performance(value: float, 
                          metric_type: str,
                          precision: int = 2) -> str:
        """
        Format performance metric with appropriate units.
        
        Args:
            value: Metric value
            metric_type: Type of metric (GFLOPS, TFLOPS, ms, GB/s, etc.)
            precision: Decimal places
        
        Returns:
            Formatted metric string
        """
        formatted_value = MetricFormatter.format_number(value, precision, use_suffix=False)
        return f"{formatted_value} {metric_type}"
    
    @staticmethod
    def format_speedup(speedup: float, precision: int = 2) -> str:
        """
        Format speedup value with appropriate styling.
        
        Args:
            speedup: Speedup multiplier (e.g., 5.2 for 5.2x)
            precision: Decimal places
        
        Returns:
            Formatted speedup string
        """
        return f"{speedup:.{precision}f}x"
    
    @staticmethod
    def format_time(milliseconds: float, auto_unit: bool = True) -> str:
        """
        Format time duration with appropriate unit.
        
        Args:
            milliseconds: Time in milliseconds
            auto_unit: Whether to automatically select best unit
        
        Returns:
            Formatted time string
        """
        if not auto_unit:
            return f"{milliseconds:.2f}ms"
        
        if milliseconds < 1:
            return f"{milliseconds*1000:.2f}μs"
        elif milliseconds < 1000:
            return f"{milliseconds:.2f}ms"
        elif milliseconds < 60000:
            return f"{milliseconds/1000:.2f}s"
        else:
            minutes = int(milliseconds / 60000)
            seconds = (milliseconds % 60000) / 1000
            return f"{minutes}m {seconds:.1f}s"


class ComparisonFormatter:
    """Formatters for comparing performance metrics."""
    
    @staticmethod
    def format_change(baseline: float,
                     current: float,
                     metric_type: str = 'GFLOPS') -> Dict[str, str]:
        """
        Format performance change between baseline and current.
        
        Args:
            baseline: Baseline value
            current: Current value
            metric_type: Type of metric
        
        Returns:
            Dictionary with formatted comparison strings
        """
        if baseline == 0:
            return {
                'absolute': 'N/A',
                'relative': 'N/A',
                'direction': 'neutral',
                'summary': 'No baseline available'
            }
        
        absolute_change = current - baseline
        relative_change = (absolute_change / baseline) * 100
        
        # Determine if change is improvement
        timing_metrics = ['ms', 'seconds', 's', 'time', 'latency']
        is_timing = any(tm in metric_type.lower() for tm in timing_metrics)
        
        if is_timing:
            # Lower is better for timing
            is_improvement = current < baseline
            direction_symbol = '↓' if is_improvement else '↑'
        else:
            # Higher is better for throughput
            is_improvement = current > baseline
            direction_symbol = '↑' if is_improvement else '↓'
        
        direction = 'improvement' if is_improvement else 'regression'
        
        # Format summary
        if abs(relative_change) < 1:
            summary = f"~No change ({direction_symbol} {abs(relative_change):.1f}%)"
        elif is_improvement:
            summary = f"✓ Improved by {abs(relative_change):.1f}% {direction_symbol}"
        else:
            summary = f"⚠ Regressed by {abs(relative_change):.1f}% {direction_symbol}"
        
        return {
            'absolute': MetricFormatter.format_number(absolute_change),
            'relative': MetricFormatter.format_percentage(relative_change),
            'direction': direction,
            'summary': summary,
            'is_improvement': is_improvement
        }
    
    @staticmethod
    def format_comparison_table(results: List[Dict[str, Any]],
                               baseline: Optional[Dict[str, Any]] = None) -> List[List[str]]:
        """
        Format results into a comparison table.
        
        Args:
            results: List of result dictionaries
            baseline: Optional baseline for comparison
        
        Returns:
            2D list representing table rows
        """
        if not results:
            return []
        
        # Header row
        if baseline:
            headers = ['Metric', 'Value', 'Unit', 'vs Baseline', 'Change %']
        else:
            headers = ['Metric', 'Value', 'Unit']
        
        table = [headers]
        
        # Data rows
        for result in results:
            name = result.get('name', 'Unknown')
            value = result.get('value', 0)
            metric_type = result.get('metric_type', '')
            
            row = [
                name,
                MetricFormatter.format_number(value),
                metric_type
            ]
            
            if baseline:
                baseline_val = baseline.get('value', 0)
                if baseline_val > 0:
                    comparison = ComparisonFormatter.format_change(
                        baseline_val, value, metric_type
                    )
                    row.append(comparison['absolute'])
                    row.append(comparison['relative'])
                else:
                    row.extend(['N/A', 'N/A'])
            
            table.append(row)
        
        return table


class StatisticalFormatter:
    """Formatters for statistical data presentation."""
    
    @staticmethod
    def format_distribution(values: List[float],
                          metric_type: str = 'GFLOPS') -> Dict[str, str]:
        """
        Format statistical distribution of values.
        
        Args:
            values: List of values
            metric_type: Type of metric
        
        Returns:
            Dictionary with formatted statistics
        """
        if not values:
            return {'error': 'No data available'}
        
        mean_val = statistics.mean(values)
        median_val = statistics.median(values)
        std_dev = statistics.stdev(values) if len(values) > 1 else 0
        min_val = min(values)
        max_val = max(values)
        
        # Coefficient of variation
        cv = (std_dev / mean_val * 100) if mean_val != 0 else 0
        
        return {
            'mean': MetricFormatter.format_performance(mean_val, metric_type),
            'median': MetricFormatter.format_performance(median_val, metric_type),
            'std_dev': MetricFormatter.format_performance(std_dev, metric_type),
            'min': MetricFormatter.format_performance(min_val, metric_type),
            'max': MetricFormatter.format_performance(max_val, metric_type),
            'cv': MetricFormatter.format_percentage(cv),
            'range': f"{MetricFormatter.format_number(min_val)} - {MetricFormatter.format_number(max_val)}"
        }
    
    @staticmethod
    def format_confidence_interval(mean: float,
                                   std_dev: float,
                                   n: int,
                                   confidence: float = 0.95) -> str:
        """
        Format confidence interval.
        
        Args:
            mean: Mean value
            std_dev: Standard deviation
            n: Sample size
            confidence: Confidence level (0-1)
        
        Returns:
            Formatted confidence interval string
        """
        # t-score approximation for 95% confidence
        t_score = 1.96 if confidence >= 0.95 else 1.645
        
        margin = t_score * (std_dev / (n ** 0.5)) if n > 0 else 0
        lower = mean - margin
        upper = mean + margin
        
        return (f"{MetricFormatter.format_number(mean)} "
                f"± {MetricFormatter.format_number(margin)} "
                f"[{MetricFormatter.format_number(lower)} - "
                f"{MetricFormatter.format_number(upper)}]")


class TextFormatter:
    """Text formatting utilities for reports."""
    
    @staticmethod
    def format_list(items: List[str],
                   style: str = 'bullet',
                   indent: int = 0) -> str:
        """
        Format list of items.
        
        Args:
            items: List items
            style: 'bullet', 'numbered', or 'plain'
            indent: Indentation level
        
        Returns:
            Formatted list string
        """
        if not items:
            return ""
        
        indent_str = "  " * indent
        formatted_items = []
        
        for i, item in enumerate(items, 1):
            if style == 'bullet':
                formatted_items.append(f"{indent_str}• {item}")
            elif style == 'numbered':
                formatted_items.append(f"{indent_str}{i}. {item}")
            else:
                formatted_items.append(f"{indent_str}{item}")
        
        return "\n".join(formatted_items)
    
    @staticmethod
    def format_key_value(data: Dict[str, Any],
                        separator: str = ': ',
                        indent: int = 0) -> str:
        """
        Format dictionary as key-value pairs.
        
        Args:
            data: Dictionary to format
            separator: Separator between key and value
            indent: Indentation level
        
        Returns:
            Formatted string
        """
        indent_str = "  " * indent
        lines = []
        
        for key, value in data.items():
            # Format key (capitalize, replace underscores)
            formatted_key = key.replace('_', ' ').title()
            
            # Format value
            if isinstance(value, float):
                formatted_value = MetricFormatter.format_number(value)
            else:
                formatted_value = str(value)
            
            lines.append(f"{indent_str}{formatted_key}{separator}{formatted_value}")
        
        return "\n".join(lines)
    
    @staticmethod
    def truncate_text(text: str, max_length: int = 100, suffix: str = '...') -> str:
        """
        Truncate text to maximum length.
        
        Args:
            text: Text to truncate
            max_length: Maximum length
            suffix: Suffix to add when truncated
        
        Returns:
            Truncated text
        """
        if len(text) <= max_length:
            return text
        
        truncate_at = max_length - len(suffix)
        return text[:truncate_at].rstrip() + suffix
    
    @staticmethod
    def format_duration(start: datetime, end: datetime) -> str:
        """
        Format time duration between two datetimes.
        
        Args:
            start: Start datetime
            end: End datetime
        
        Returns:
            Formatted duration string
        """
        delta = end - start
        
        if delta.days > 0:
            return f"{delta.days} days, {delta.seconds//3600} hours"
        elif delta.seconds >= 3600:
            hours = delta.seconds // 3600
            minutes = (delta.seconds % 3600) // 60
            return f"{hours}h {minutes}m"
        elif delta.seconds >= 60:
            minutes = delta.seconds // 60
            seconds = delta.seconds % 60
            return f"{minutes}m {seconds}s"
        else:
            return f"{delta.seconds}s"


class AudienceFormatter:
    """Format content based on target audience."""
    
    @staticmethod
    def format_for_executive(technical_text: str, 
                            key_metrics: Dict[str, float]) -> str:
        """
        Simplify technical content for executive audience.
        
        Args:
            technical_text: Technical description
            key_metrics: Key metrics to highlight
        
        Returns:
            Executive-friendly text
        """
        # Extract key points and simplify
        exec_text = technical_text
        
        # Add business context
        if 'speedup' in key_metrics:
            speedup = key_metrics['speedup']
            exec_text = (f"System delivers {speedup:.1f}x performance improvement. "
                        f"{exec_text}")
        
        return exec_text
    
    @staticmethod
    def format_for_technical(summary: str, details: Dict[str, Any]) -> str:
        """
        Add technical depth for engineering audience.
        
        Args:
            summary: High-level summary
            details: Technical details to include
        
        Returns:
            Technical-focused text
        """
        tech_text = summary + "\n\nTechnical Details:\n"
        tech_text += TextFormatter.format_key_value(details, indent=1)
        
        return tech_text


# Convenience functions for common formatting tasks

def format_metric(value: float, metric_type: str) -> str:
    """Quick format for metric value."""
    return MetricFormatter.format_performance(value, metric_type)


def format_comparison(baseline: float, current: float, metric_type: str) -> str:
    """Quick format for comparison."""
    result = ComparisonFormatter.format_change(baseline, current, metric_type)
    return result['summary']


def format_statistics(values: List[float], metric_type: str) -> Dict[str, str]:
    """Quick format for statistics."""
    return StatisticalFormatter.format_distribution(values, metric_type)
