"""
Performance visualization engine.
Creates professional charts and graphs for benchmark analysis.
"""

from typing import List, Dict, Optional, Tuple
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime
import numpy as np

from parsers import BenchmarkResult, BenchmarkSuite
from analyzer import AnalysisReport, ComparisonResult


class PerformanceVisualizer:
    """Creates professional visualizations for performance analysis."""
    
    # Professional color scheme
    COLORS = {
        'primary': '#2E86AB',      # Blue
        'secondary': '#A23B72',    # Purple
        'accent': '#F18F01',       # Orange
        'success': '#06A77D',      # Green
        'danger': '#C73E1D',       # Red
        'neutral': '#6C757D',      # Gray
        'dark': '#2B2D42',         # Dark blue-gray
        'light': '#EDF2F4'         # Light gray
    }
    
    def __init__(self, style='default', figsize=(12, 7), dpi=100):
        """
        Initialize visualizer.
        
        Args:
            style: Matplotlib style ('default', 'dark_background', 'seaborn')
            figsize: Figure size (width, height)
            dpi: Resolution in dots per inch
        """
        self.style = style
        self.figsize = figsize
        self.dpi = dpi
        
        # Set style
        plt.style.use(style)
    
    def plot_performance_comparison(self, 
                                   suite: BenchmarkSuite,
                                   metric_type: str = 'GFLOPS',
                                   output_path: Optional[str] = None) -> str:
        """
        Create bar chart comparing CUDA vs CPU performance.
        
        Args:
            suite: Benchmark suite to visualize
            metric_type: Metric type to plot ('GFLOPS', 'TFLOPS', 'ms', etc.)
            output_path: Where to save the chart (default: auto-generated)
        
        Returns:
            Path to saved chart
        """
        # Get results for this metric
        cuda_results = [r for r in suite.results 
                       if 'CUDA' in r.name and r.metric_type == metric_type]
        cpu_results = [r for r in suite.results 
                      if 'CPU' in r.name and r.metric_type == metric_type]
        
        if not cuda_results and not cpu_results:
            raise ValueError(f"No results found for metric type: {metric_type}")
        
        # Extract configurations (e.g., matrix sizes)
        configs = []
        cuda_values = []
        cpu_values = []
        
        # Match CUDA and CPU results by configuration
        for cuda_res in cuda_results:
            config = cuda_res.metadata.get('matrix_dims', 'Unknown')
            configs.append(config)
            cuda_values.append(cuda_res.value)
            
            # Find matching CPU result
            cpu_val = 0
            for cpu_res in cpu_results:
                cpu_config = cpu_res.metadata.get('matrix_dims', 'Unknown')
                if cpu_config == config:
                    cpu_val = cpu_res.value
                    break
            cpu_values.append(cpu_val)
        
        # Create figure
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        x = np.arange(len(configs))
        width = 0.35
        
        # Create bars
        cuda_bars = ax.bar(x - width/2, cuda_values, width, 
                          label='CUDA', color=self.COLORS['primary'], alpha=0.9)
        cpu_bars = ax.bar(x + width/2, cpu_values, width, 
                         label='CPU', color=self.COLORS['secondary'], alpha=0.9)
        
        # Customize
        ax.set_xlabel('Configuration', fontsize=12, fontweight='bold')
        ax.set_ylabel(f'Performance ({metric_type})', fontsize=12, fontweight='bold')
        ax.set_title(f'CUDA vs CPU Performance Comparison\n{suite.name}', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(configs, rotation=45, ha='right')
        ax.legend(fontsize=11)
        ax.grid(axis='y', alpha=0.3, linestyle='--')
        
        # Add value labels on bars
        for bars in [cuda_bars, cpu_bars]:
            for bar in bars:
                height = bar.get_height()
                if height > 0:
                    ax.text(bar.get_x() + bar.get_width()/2., height,
                           f'{height:.1f}',
                           ha='center', va='bottom', fontsize=9)
        
        # Calculate and display speedup
        speedups = [c/p if p > 0 else 0 for c, p in zip(cuda_values, cpu_values)]
        avg_speedup = np.mean([s for s in speedups if s > 0])
        
        # Add speedup annotation
        ax.text(0.02, 0.98, f'Avg Speedup: {avg_speedup:.1f}x',
               transform=ax.transAxes, fontsize=11, verticalalignment='top',
               bbox=dict(boxstyle='round', facecolor=self.COLORS['light'], alpha=0.8))
        
        plt.tight_layout()
        
        # Save
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'/mnt/user-data/outputs/performance_comparison_{timestamp}.png'
        
        plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
        plt.close()
        
        return output_path
    
    def plot_scaling_performance(self,
                                suite: BenchmarkSuite,
                                metric_type: str = 'TFLOPS',
                                output_path: Optional[str] = None) -> str:
        """
        Create line chart showing performance scaling with problem size.
        
        Args:
            suite: Benchmark suite to visualize
            metric_type: Metric type to plot
            output_path: Where to save the chart
        
        Returns:
            Path to saved chart
        """
        # Get results and extract matrix sizes
        results = [r for r in suite.results if r.metric_type == metric_type]
        
        if not results:
            raise ValueError(f"No results found for metric type: {metric_type}")
        
        # Group by CUDA/CPU
        cuda_data = {}
        cpu_data = {}
        
        for result in results:
            size = result.metadata.get('matrix_size', 0)
            if size == 0:
                continue
            
            if 'CUDA' in result.name:
                cuda_data[size] = result.value
            elif 'CPU' in result.name:
                cpu_data[size] = result.value
        
        # Sort by size
        if cuda_data:
            cuda_sizes = sorted(cuda_data.keys())
            cuda_values = [cuda_data[s] for s in cuda_sizes]
        else:
            cuda_sizes, cuda_values = [], []
        
        if cpu_data:
            cpu_sizes = sorted(cpu_data.keys())
            cpu_values = [cpu_data[s] for s in cpu_sizes]
        else:
            cpu_sizes, cpu_values = [], []
        
        # Create figure
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        # Plot lines
        if cuda_sizes:
            ax.plot(cuda_sizes, cuda_values, marker='o', linewidth=2.5, 
                   markersize=8, label='CUDA', color=self.COLORS['primary'])
        
        if cpu_sizes:
            ax.plot(cpu_sizes, cpu_values, marker='s', linewidth=2.5,
                   markersize=8, label='CPU', color=self.COLORS['secondary'])
        
        # Customize
        ax.set_xlabel('Matrix Size (N×N)', fontsize=12, fontweight='bold')
        ax.set_ylabel(f'Performance ({metric_type})', fontsize=12, fontweight='bold')
        ax.set_title(f'Performance Scaling Analysis\n{suite.name}', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.legend(fontsize=11, loc='best')
        ax.grid(True, alpha=0.3, linestyle='--')
        
        # Use log scale if large range
        if cuda_sizes or cpu_sizes:
            all_sizes = cuda_sizes + cpu_sizes
            if max(all_sizes) / min(all_sizes) > 10:
                ax.set_xscale('log')
        
        plt.tight_layout()
        
        # Save
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'/mnt/user-data/outputs/scaling_performance_{timestamp}.png'
        
        plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
        plt.close()
        
        return output_path
    
    def plot_bottleneck_analysis(self,
                                report: AnalysisReport,
                                output_path: Optional[str] = None) -> str:
        """
        Create visualization of identified bottlenecks.
        
        Args:
            report: Analysis report containing bottlenecks
            output_path: Where to save the chart
        
        Returns:
            Path to saved chart
        """
        if not report.bottlenecks:
            # Create empty figure with message
            fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
            ax.text(0.5, 0.5, 'No bottlenecks identified\n✓ Performance looks good!',
                   ha='center', va='center', fontsize=16, 
                   bbox=dict(boxstyle='round', facecolor=self.COLORS['success'], 
                            alpha=0.2, edgecolor=self.COLORS['success'], linewidth=2))
            ax.axis('off')
            plt.tight_layout()
            
            if output_path is None:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                output_path = f'/mnt/user-data/outputs/bottleneck_analysis_{timestamp}.png'
            
            plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
            plt.close()
            return output_path
        
        # Create horizontal bar chart of bottlenecks by impact
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        # Sort by impact
        sorted_bottlenecks = sorted(report.bottlenecks, key=lambda b: b.impact)
        
        components = [b.component for b in sorted_bottlenecks]
        impacts = [b.impact for b in sorted_bottlenecks]
        
        # Color by severity
        severity_colors = {
            'critical': self.COLORS['danger'],
            'high': self.COLORS['accent'],
            'medium': '#FFC107',  # Amber
            'low': self.COLORS['neutral']
        }
        colors = [severity_colors.get(b.severity, self.COLORS['neutral']) 
                 for b in sorted_bottlenecks]
        
        # Create bars
        bars = ax.barh(components, impacts, color=colors, alpha=0.9)
        
        # Customize
        ax.set_xlabel('Performance Impact (%)', fontsize=12, fontweight='bold')
        ax.set_title('Performance Bottleneck Analysis', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.grid(axis='x', alpha=0.3, linestyle='--')
        
        # Add impact values
        for i, (bar, impact) in enumerate(zip(bars, impacts)):
            width = bar.get_width()
            severity = sorted_bottlenecks[i].severity
            ax.text(width + 1, bar.get_y() + bar.get_height()/2,
                   f'{impact:.1f}% ({severity})',
                   va='center', fontsize=9, fontweight='bold')
        
        # Add legend
        legend_elements = [
            mpatches.Patch(color=severity_colors['critical'], label='Critical'),
            mpatches.Patch(color=severity_colors['high'], label='High'),
            mpatches.Patch(color='#FFC107', label='Medium'),
            mpatches.Patch(color=severity_colors['low'], label='Low')
        ]
        ax.legend(handles=legend_elements, loc='lower right', fontsize=10)
        
        plt.tight_layout()
        
        # Save
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'/mnt/user-data/outputs/bottleneck_analysis_{timestamp}.png'
        
        plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
        plt.close()
        
        return output_path
    
    def plot_historical_trend(self,
                            metric_name: str,
                            history: List[BenchmarkSuite],
                            output_path: Optional[str] = None) -> str:
        """
        Create line chart showing performance trends over time.
        
        Args:
            metric_name: Name of metric to track
            history: List of historical benchmark suites
            output_path: Where to save the chart
        
        Returns:
            Path to saved chart
        """
        if not history:
            raise ValueError("No historical data provided")
        
        # Extract values over time
        timestamps = []
        values = []
        
        for suite in history:
            result = suite.get_metric(metric_name)
            if result:
                timestamps.append(suite.timestamp)
                values.append(result.value)
        
        if not values:
            raise ValueError(f"Metric '{metric_name}' not found in historical data")
        
        # Create figure
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        # Plot trend
        ax.plot(timestamps, values, marker='o', linewidth=2.5, markersize=8,
               color=self.COLORS['primary'])
        
        # Add trend line
        if len(values) > 2:
            x_numeric = [(t - timestamps[0]).total_seconds() for t in timestamps]
            z = np.polyfit(x_numeric, values, 1)
            p = np.poly1d(z)
            ax.plot(timestamps, p(x_numeric), "--", color=self.COLORS['accent'],
                   linewidth=2, alpha=0.7, label='Trend')
        
        # Customize
        ax.set_xlabel('Time', fontsize=12, fontweight='bold')
        ax.set_ylabel('Performance', fontsize=12, fontweight='bold')
        ax.set_title(f'Historical Performance Trend\n{metric_name}', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.grid(True, alpha=0.3, linestyle='--')
        ax.legend(fontsize=11)
        
        # Format x-axis dates
        fig.autofmt_xdate()
        
        # Calculate improvement
        if len(values) > 1:
            improvement = ((values[-1] - values[0]) / values[0]) * 100
            color = self.COLORS['success'] if improvement > 0 else self.COLORS['danger']
            ax.text(0.02, 0.98, f'Change: {improvement:+.1f}%',
                   transform=ax.transAxes, fontsize=11, verticalalignment='top',
                   bbox=dict(boxstyle='round', facecolor=color, alpha=0.2,
                            edgecolor=color, linewidth=2))
        
        plt.tight_layout()
        
        # Save
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'/mnt/user-data/outputs/historical_trend_{timestamp}.png'
        
        plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
        plt.close()
        
        return output_path
    
    def create_dashboard(self,
                        suite: BenchmarkSuite,
                        report: AnalysisReport,
                        output_path: Optional[str] = None) -> str:
        """
        Create comprehensive dashboard with multiple visualizations.
        
        Args:
            suite: Benchmark suite
            report: Analysis report
            output_path: Where to save the dashboard
        
        Returns:
            Path to saved dashboard
        """
        # Create figure with subplots
        fig = plt.figure(figsize=(16, 10), dpi=self.dpi)
        gs = fig.add_gridspec(2, 2, hspace=0.3, wspace=0.3)
        
        # 1. Performance comparison (top-left)
        ax1 = fig.add_subplot(gs[0, 0])
        self._add_comparison_subplot(ax1, suite, 'GFLOPS')
        
        # 2. Scaling performance (top-right)
        ax2 = fig.add_subplot(gs[0, 1])
        self._add_scaling_subplot(ax2, suite, 'TFLOPS')
        
        # 3. Bottleneck analysis (bottom-left)
        ax3 = fig.add_subplot(gs[1, 0])
        self._add_bottleneck_subplot(ax3, report)
        
        # 4. Summary stats (bottom-right)
        ax4 = fig.add_subplot(gs[1, 1])
        self._add_summary_subplot(ax4, report)
        
        # Main title
        fig.suptitle(f'Performance Analysis Dashboard\n{suite.name}',
                    fontsize=16, fontweight='bold', y=0.98)
        
        # Save
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = f'/mnt/user-data/outputs/performance_dashboard_{timestamp}.png'
        
        plt.savefig(output_path, bbox_inches='tight', dpi=self.dpi)
        plt.close()
        
        return output_path
    
    def _add_comparison_subplot(self, ax, suite, metric_type):
        """Helper to add comparison chart to subplot."""
        cuda_results = [r for r in suite.results 
                       if 'CUDA' in r.name and r.metric_type == metric_type]
        cpu_results = [r for r in suite.results 
                      if 'CPU' in r.name and r.metric_type == metric_type]
        
        if cuda_results or cpu_results:
            configs = [r.metadata.get('matrix_dims', 'Unknown') for r in cuda_results]
            cuda_values = [r.value for r in cuda_results]
            cpu_values = []
            for cuda_res in cuda_results:
                config = cuda_res.metadata.get('matrix_dims', 'Unknown')
                cpu_val = 0
                for cpu_res in cpu_results:
                    if cpu_res.metadata.get('matrix_dims', 'Unknown') == config:
                        cpu_val = cpu_res.value
                        break
                cpu_values.append(cpu_val)
            
            x = np.arange(len(configs))
            width = 0.35
            ax.bar(x - width/2, cuda_values, width, label='CUDA', color=self.COLORS['primary'])
            ax.bar(x + width/2, cpu_values, width, label='CPU', color=self.COLORS['secondary'])
            ax.set_title('CUDA vs CPU', fontweight='bold')
            ax.set_ylabel(metric_type)
            ax.set_xticks(x)
            ax.set_xticklabels(configs, rotation=45, ha='right')
            ax.legend()
            ax.grid(axis='y', alpha=0.3)
    
    def _add_scaling_subplot(self, ax, suite, metric_type):
        """Helper to add scaling chart to subplot."""
        results = [r for r in suite.results if r.metric_type == metric_type and 'CUDA' in r.name]
        if results:
            sizes = [r.metadata.get('matrix_size', 0) for r in results]
            values = [r.value for r in results]
            ax.plot(sizes, values, marker='o', linewidth=2, color=self.COLORS['primary'])
            ax.set_title('Performance Scaling', fontweight='bold')
            ax.set_xlabel('Matrix Size')
            ax.set_ylabel(metric_type)
            ax.grid(True, alpha=0.3)
    
    def _add_bottleneck_subplot(self, ax, report):
        """Helper to add bottleneck chart to subplot."""
        if report.bottlenecks:
            components = [b.component[:20] for b in report.bottlenecks[:5]]  # Top 5
            impacts = [b.impact for b in report.bottlenecks[:5]]
            ax.barh(components, impacts, color=self.COLORS['danger'], alpha=0.7)
            ax.set_title('Top Bottlenecks', fontweight='bold')
            ax.set_xlabel('Impact (%)')
        else:
            ax.text(0.5, 0.5, 'No Bottlenecks\nDetected ✓', 
                   ha='center', va='center', fontsize=14, color=self.COLORS['success'])
            ax.axis('off')
    
    def _add_summary_subplot(self, ax, report):
        """Helper to add summary text to subplot."""
        ax.axis('off')
        
        # Build summary text
        summary_text = f"Analysis Summary\n{'='*40}\n\n"
        summary_text += f"{report.summary}\n\n"
        
        if report.recommendations:
            summary_text += "Top Recommendations:\n"
            for i, rec in enumerate(report.recommendations[:3], 1):
                summary_text += f"{i}. {rec[:60]}...\n"
        
        ax.text(0.05, 0.95, summary_text, transform=ax.transAxes,
               fontsize=10, verticalalignment='top', family='monospace',
               bbox=dict(boxstyle='round', facecolor=self.COLORS['light'], alpha=0.8))


def create_visualizations(suite: BenchmarkSuite, 
                         report: AnalysisReport) -> Dict[str, str]:
    """
    Quick function to create all standard visualizations.
    
    Returns:
        Dictionary mapping visualization type to file path
    """
    viz = PerformanceVisualizer()
    outputs = {}
    
    try:
        outputs['comparison'] = viz.plot_performance_comparison(suite, 'GFLOPS')
    except Exception:
        pass
    
    try:
        outputs['scaling'] = viz.plot_scaling_performance(suite, 'TFLOPS')
    except Exception:
        pass
    
    try:
        outputs['bottlenecks'] = viz.plot_bottleneck_analysis(report)
    except Exception:
        pass
    
    try:
        outputs['dashboard'] = viz.create_dashboard(suite, report)
    except Exception:
        pass
    
    return outputs
