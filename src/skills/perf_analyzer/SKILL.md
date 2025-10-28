---
name: perf-analyzer
description: Analyzes performance benchmarks from CUDA, CPU, memory tests. Parses output, identifies bottlenecks, tracks metrics over time, generates optimization insights.
---

# Performance Analyzer Skill

## Purpose
Analyzes performance benchmarks and profiling data from CUDA, CPU, memory, and system tests. Automatically parses benchmark output, identifies performance bottlenecks, tracks metrics over time, and generates actionable optimization insights.

## Capabilities

### Benchmark Parsing
- CUDA kernel benchmarks (GFLOPS, TFLOPS, execution time)
- CPU benchmarks (GFLOPS, multi-core performance)
- Memory bandwidth tests
- Custom benchmark formats (CSV, JSON, text output)

### Analysis Features
- Performance regression detection
- Bottleneck identification
- Comparison across runs/configurations
- Statistical analysis (mean, std dev, percentiles)
- Speedup calculations
- Efficiency metrics

### Tracking
- Historical performance data
- Trend analysis over time
- Configuration impact analysis

## Usage

The skill automatically loads when you:
- Ask to analyze benchmark results
- Request performance comparisons
- Need to identify bottlenecks
- Want to track performance over time

## Files

- `parsers.py` - Parsers for various benchmark formats
- `analyzer.py` - Core analysis logic and metrics calculation
- `visualizer.py` - Data visualization and charting

## Example Workflows

1. **Single Benchmark Analysis**
   - Parse benchmark output
   - Calculate key metrics
   - Identify bottlenecks
   - Generate summary

2. **Comparative Analysis**
   - Parse multiple benchmark runs
   - Compare performance across configurations
   - Calculate speedups and improvements
   - Highlight regressions

3. **Historical Tracking**
   - Store results over time
   - Detect performance trends
   - Alert on regressions
   - Track optimization impact

## Integration

Works seamlessly with:
- `tech-report` skill for generating professional reports
- `xlsx` skill for detailed data tables
- `pptx` skill for presentation-ready visualizations
