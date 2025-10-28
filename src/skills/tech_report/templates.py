"""
Pre-built report templates for different use cases.
"""

from typing import Dict, List, Any


class ReportTemplates:
    """Collection of pre-built report templates."""
    
    @staticmethod
    def investor_update() -> Dict[str, Any]:
        """
        Template for investor update reports.
        Focus: Business impact, competitive advantage, growth metrics.
        """
        return {
            'title': 'Technical Performance Update',
            'subtitle': 'Quarterly Progress Report',
            'sections': [
                'executive_summary',
                'key_achievements',
                'performance_metrics',
                'competitive_analysis',
                'roadmap'
            ],
            'style': 'executive',
            'focus': 'business_impact'
        }
    
    @staticmethod
    def benchmark_report() -> Dict[str, Any]:
        """
        Template for benchmark validation reports.
        Focus: Performance metrics, comparisons, validation.
        """
        return {
            'title': 'Performance Benchmark Report',
            'subtitle': 'System Performance Analysis',
            'sections': [
                'executive_summary',
                'test_methodology',
                'performance_overview',
                'comparative_analysis',
                'technical_specifications'
            ],
            'style': 'benchmark',
            'focus': 'metrics'
        }
    
    @staticmethod
    def optimization_report() -> Dict[str, Any]:
        """
        Template for optimization analysis reports.
        Focus: Bottlenecks, recommendations, action items.
        """
        return {
            'title': 'Performance Optimization Analysis',
            'subtitle': 'Bottleneck Identification & Recommendations',
            'sections': [
                'executive_summary',
                'current_performance',
                'bottleneck_analysis',
                'optimization_opportunities',
                'recommendations',
                'implementation_plan'
            ],
            'style': 'technical',
            'focus': 'optimization'
        }
    
    @staticmethod
    def client_deliverable() -> Dict[str, Any]:
        """
        Template for client deliverable reports.
        Focus: Professional presentation, clear results, next steps.
        """
        return {
            'title': 'Performance Analysis Deliverable',
            'subtitle': 'Technical Assessment Report',
            'sections': [
                'executive_summary',
                'objectives',
                'methodology',
                'results',
                'analysis',
                'recommendations',
                'conclusion'
            ],
            'style': 'comprehensive',
            'focus': 'client_delivery'
        }
    
    @staticmethod
    def progress_report() -> Dict[str, Any]:
        """
        Template for ongoing progress tracking.
        Focus: Trends, improvements, historical comparison.
        """
        return {
            'title': 'Performance Progress Report',
            'subtitle': 'Historical Trend Analysis',
            'sections': [
                'executive_summary',
                'progress_overview',
                'trend_analysis',
                'achievements',
                'challenges',
                'next_steps'
            ],
            'style': 'comprehensive',
            'focus': 'trends'
        }
    
    @staticmethod
    def technical_deep_dive() -> Dict[str, Any]:
        """
        Template for detailed technical analysis.
        Focus: In-depth technical details, for engineering teams.
        """
        return {
            'title': 'Technical Deep Dive',
            'subtitle': 'Comprehensive Performance Analysis',
            'sections': [
                'overview',
                'architecture',
                'performance_metrics',
                'bottleneck_analysis',
                'optimization_strategies',
                'implementation_details',
                'technical_specifications',
                'appendix'
            ],
            'style': 'technical',
            'focus': 'technical_depth'
        }


class SectionTemplates:
    """Pre-built content templates for common report sections."""
    
    @staticmethod
    def executive_summary_template(metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate executive summary template."""
        speedup = metrics.get('speedup', 0)
        tflops = metrics.get('tflops', 0)
        
        if speedup > 1:
            summary = (
                f"Performance analysis demonstrates {speedup:.1f}x improvement over baseline. "
                f"System achieves {tflops:.2f} TFLOPS in computational throughput, "
                "representing significant performance gains and competitive advantages."
            )
        else:
            summary = (
                f"Performance analysis complete. System achieves {tflops:.2f} TFLOPS "
                "in computational throughput. Analysis identifies optimization opportunities "
                "for enhanced performance."
            )
        
        return {
            'summary': summary,
            'key_findings': [
                f"Achieved {tflops:.2f} TFLOPS computational performance",
                f"GPU acceleration provides {speedup:.1f}x speedup over CPU baseline" if speedup > 1 else "Baseline performance established",
                "System operates within expected performance parameters",
                "Multiple optimization opportunities identified"
            ],
            'key_metrics': {
                'speedup': speedup,
                'tflops': tflops
            }
        }
    
    @staticmethod
    def competitive_analysis_template(performance: float, 
                                     industry_benchmark: float = 20.0) -> str:
        """Generate competitive analysis text."""
        percentage = (performance / industry_benchmark) * 100
        
        if percentage >= 90:
            analysis = (
                f"System performance at {performance:.1f} TFLOPS represents {percentage:.0f}% "
                f"of industry-leading solutions (≈{industry_benchmark} TFLOPS for high-end GPUs). "
                "Performance is highly competitive and suitable for production deployment."
            )
        elif percentage >= 60:
            analysis = (
                f"System achieves {performance:.1f} TFLOPS, representing {percentage:.0f}% "
                f"of industry-leading performance. Significant optimization opportunities exist "
                "to reach top-tier performance levels."
            )
        else:
            analysis = (
                f"Current performance at {performance:.1f} TFLOPS represents {percentage:.0f}% "
                f"of industry benchmarks. Substantial optimization work recommended to achieve "
                "competitive performance targets."
            )
        
        return analysis
    
    @staticmethod
    def implementation_plan_template(recommendations: List[str]) -> Dict[str, Any]:
        """Generate implementation plan from recommendations."""
        if not recommendations:
            return {
                'phases': [],
                'timeline': 'N/A',
                'priorities': []
            }
        
        # Categorize recommendations into phases
        phases = {
            'immediate': [],
            'short_term': [],
            'long_term': []
        }
        
        # Simple categorization based on keywords
        for rec in recommendations:
            rec_lower = rec.lower()
            if any(word in rec_lower for word in ['critical', 'immediately', 'urgent']):
                phases['immediate'].append(rec)
            elif any(word in rec_lower for word in ['consider', 'evaluate', 'explore']):
                phases['long_term'].append(rec)
            else:
                phases['short_term'].append(rec)
        
        return {
            'phases': [
                {
                    'name': 'Immediate Actions (Week 1)',
                    'items': phases['immediate'] or ['No immediate actions required']
                },
                {
                    'name': 'Short-term Optimizations (Weeks 2-4)',
                    'items': phases['short_term'] or ['Continue performance monitoring']
                },
                {
                    'name': 'Long-term Improvements (Months 2-3)',
                    'items': phases['long_term'] or ['Evaluate advanced optimization strategies']
                }
            ],
            'timeline': '1-3 months',
            'priorities': phases['immediate'] + phases['short_term'][:2]
        }


class BrandingTemplates:
    """Branding and customization templates."""
    
    @staticmethod
    def saaam_llc_branding() -> Dict[str, Any]:
        """SAAAM LLC company branding."""
        return {
            'company_name': 'SAAAM LLC',
            'tagline': 'High-Performance Computing Solutions',
            'color_primary': '#2E86AB',
            'color_secondary': '#A23B72',
            'font_heading': 'Calibri',
            'font_body': 'Calibri'
        }
    
    @staticmethod
    def custom_branding(company: str,
                       tagline: str = '',
                       colors: Dict[str, str] = None) -> Dict[str, Any]:
        """Create custom branding configuration."""
        return {
            'company_name': company,
            'tagline': tagline,
            'color_primary': colors.get('primary', '#2E86AB') if colors else '#2E86AB',
            'color_secondary': colors.get('secondary', '#A23B72') if colors else '#A23B72',
            'font_heading': 'Calibri',
            'font_body': 'Calibri'
        }


def get_template(template_name: str) -> Dict[str, Any]:
    """
    Get pre-built report template by name.
    
    Args:
        template_name: Name of template
            - 'investor'
            - 'benchmark'
            - 'optimization'
            - 'client'
            - 'progress'
            - 'technical'
    
    Returns:
        Template configuration
    """
    templates = {
        'investor': ReportTemplates.investor_update,
        'benchmark': ReportTemplates.benchmark_report,
        'optimization': ReportTemplates.optimization_report,
        'client': ReportTemplates.client_deliverable,
        'progress': ReportTemplates.progress_report,
        'technical': ReportTemplates.technical_deep_dive
    }
    
    template_func = templates.get(template_name.lower())
    if template_func:
        return template_func()
    else:
        # Default to comprehensive
        return ReportTemplates.client_deliverable()
