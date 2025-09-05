#!/usr/bin/env python3
"""
Morphik Test Runner
Comprehensive test runner for Morphik API integration tests
"""
import sys
import os
import subprocess
import argparse
import time
from pathlib import Path


class MorphikTestRunner:
    """Test runner for Morphik integration tests"""
    
    def __init__(self):
        self.test_files = [
            'test_morphik_service.py',
            'test_morphik_api.py', 
            'test_morphik_integration.py'
        ]
        self.base_dir = Path(__file__).parent
    
    def run_tests(self, test_type='all', verbose=True, coverage=True, fail_fast=False):
        """
        Run Morphik tests
        
        Args:
            test_type: Type of tests to run ('unit', 'api', 'integration', 'all')
            verbose: Enable verbose output
            coverage: Enable coverage reporting
            fail_fast: Stop on first failure
        """
        print("🧪 BEACON Morphik Test Runner")
        print("=" * 50)
        
        # Determine which tests to run
        if test_type == 'unit':
            test_files = ['test_morphik_service.py']
        elif test_type == 'api':
            test_files = ['test_morphik_api.py']
        elif test_type == 'integration':
            test_files = ['test_morphik_integration.py']
        else:
            test_files = self.test_files
        
        # Build pytest command
        cmd = ['python', '-m', 'pytest']
        
        # Add test files
        for test_file in test_files:
            test_path = self.base_dir / test_file
            if test_path.exists():
                cmd.append(str(test_path))
            else:
                print(f"⚠️  Warning: Test file {test_file} not found")
        
        # Add options
        if verbose:
            cmd.append('-v')
        if coverage:
            cmd.extend([
                '--cov=services.morphik_service',
                '--cov=api.morphik',
                '--cov-report=term-missing',
                '--cov-report=html:htmlcov_morphik'
            ])
        if fail_fast:
            cmd.append('-x')
        
        # Add other useful options
        cmd.extend([
            '--tb=short',
            '--color=yes',
            '--durations=10'
        ])
        
        print(f"🚀 Running command: {' '.join(cmd)}")
        print()
        
        # Run tests
        start_time = time.time()
        result = subprocess.run(cmd, cwd=self.base_dir)
        end_time = time.time()
        
        # Report results
        print()
        print("=" * 50)
        duration = end_time - start_time
        if result.returncode == 0:
            print(f"✅ All tests passed! ({duration:.2f}s)")
        else:
            print(f"❌ Tests failed! ({duration:.2f}s)")
        
        if coverage:
            print(f"📊 Coverage report generated: htmlcov_morphik/index.html")
        
        return result.returncode == 0
    
    def run_specific_test(self, test_class=None, test_method=None, verbose=True):
        """
        Run specific test class or method
        
        Args:
            test_class: Specific test class to run (e.g., 'TestMorphikServiceQuery')
            test_method: Specific test method to run (e.g., 'test_query_success')
            verbose: Enable verbose output
        """
        print(f"🧪 Running specific test: {test_class or 'all'}::{test_method or 'all'}")
        print("=" * 50)
        
        cmd = ['python', '-m', 'pytest']
        
        # Add test selection
        if test_class and test_method:
            test_selector = f"-k {test_class} and {test_method}"
        elif test_class:
            test_selector = f"-k {test_class}"
        elif test_method:
            test_selector = f"-k {test_method}"
        else:
            test_selector = None
        
        if test_selector:
            cmd.extend(test_selector.split())
        
        # Add test files
        for test_file in self.test_files:
            test_path = self.base_dir / test_file
            if test_path.exists():
                cmd.append(str(test_path))
        
        # Add options
        if verbose:
            cmd.append('-v')
        cmd.extend(['--tb=short', '--color=yes'])
        
        print(f"🚀 Running command: {' '.join(cmd)}")
        print()
        
        result = subprocess.run(cmd, cwd=self.base_dir)
        return result.returncode == 0
    
    def validate_environment(self):
        """Validate test environment"""
        print("🔍 Validating test environment...")
        
        issues = []
        
        # Check Python version
        if sys.version_info < (3, 7):
            issues.append("Python 3.7+ required")
        
        # Check required packages
        required_packages = ['pytest', 'requests', 'flask']
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                issues.append(f"Missing package: {package}")
        
        # Check test files exist
        for test_file in self.test_files:
            test_path = self.base_dir / test_file
            if not test_path.exists():
                issues.append(f"Missing test file: {test_file}")
        
        # Check source files exist
        source_files = [
            'services/morphik_service.py',
            'api/morphik.py'
        ]
        for source_file in source_files:
            source_path = self.base_dir / source_file
            if not source_path.exists():
                issues.append(f"Missing source file: {source_file}")
        
        if issues:
            print("❌ Environment validation failed:")
            for issue in issues:
                print(f"   - {issue}")
            return False
        else:
            print("✅ Environment validation passed!")
            return True
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        print("📈 Generating comprehensive test report...")
        
        cmd = [
            'python', '-m', 'pytest',
            '--cov=services.morphik_service',
            '--cov=api.morphik',
            '--cov-report=html:htmlcov_morphik',
            '--cov-report=xml:coverage_morphik.xml',
            '--cov-report=json:coverage_morphik.json',
            '--junitxml=junit_morphik.xml',
            '--html=report_morphik.html',
            '--self-contained-html'
        ]
        
        # Add all test files
        for test_file in self.test_files:
            test_path = self.base_dir / test_file
            if test_path.exists():
                cmd.append(str(test_path))
        
        result = subprocess.run(cmd, cwd=self.base_dir)
        
        if result.returncode == 0:
            print("✅ Test report generated successfully!")
            print("   - HTML Coverage: htmlcov_morphik/index.html")
            print("   - XML Coverage: coverage_morphik.xml")
            print("   - JSON Coverage: coverage_morphik.json")
            print("   - JUnit Report: junit_morphik.xml")
            print("   - HTML Report: report_morphik.html")
        else:
            print("❌ Test report generation failed!")
        
        return result.returncode == 0
    
    def clean_test_artifacts(self):
        """Clean up test artifacts"""
        print("🧹 Cleaning test artifacts...")
        
        artifacts = [
            'htmlcov_morphik',
            'coverage_morphik.xml',
            'coverage_morphik.json', 
            'junit_morphik.xml',
            'report_morphik.html',
            '.coverage',
            '.pytest_cache',
            '__pycache__'
        ]
        
        cleaned = []
        for artifact in artifacts:
            artifact_path = self.base_dir / artifact
            if artifact_path.exists():
                if artifact_path.is_dir():
                    import shutil
                    shutil.rmtree(artifact_path)
                else:
                    artifact_path.unlink()
                cleaned.append(artifact)
        
        if cleaned:
            print(f"✅ Cleaned artifacts: {', '.join(cleaned)}")
        else:
            print("✅ No artifacts to clean")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run Morphik integration tests')
    
    parser.add_argument(
        'command',
        choices=['test', 'unit', 'api', 'integration', 'specific', 'validate', 'report', 'clean'],
        help='Command to run'
    )
    
    parser.add_argument(
        '--test-class',
        help='Specific test class to run (for specific command)'
    )
    
    parser.add_argument(
        '--test-method', 
        help='Specific test method to run (for specific command)'
    )
    
    parser.add_argument(
        '--no-coverage',
        action='store_true',
        help='Disable coverage reporting'
    )
    
    parser.add_argument(
        '--fail-fast',
        action='store_true',
        help='Stop on first failure'
    )
    
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Reduce output verbosity'
    )
    
    args = parser.parse_args()
    
    runner = MorphikTestRunner()
    
    if args.command == 'validate':
        success = runner.validate_environment()
        sys.exit(0 if success else 1)
    
    elif args.command == 'clean':
        runner.clean_test_artifacts()
        sys.exit(0)
    
    elif args.command == 'report':
        success = runner.generate_test_report()
        sys.exit(0 if success else 1)
    
    elif args.command == 'specific':
        success = runner.run_specific_test(
            test_class=args.test_class,
            test_method=args.test_method,
            verbose=not args.quiet
        )
        sys.exit(0 if success else 1)
    
    else:
        # Map command to test type
        test_type_map = {
            'test': 'all',
            'unit': 'unit', 
            'api': 'api',
            'integration': 'integration'
        }
        
        success = runner.run_tests(
            test_type=test_type_map[args.command],
            verbose=not args.quiet,
            coverage=not args.no_coverage,
            fail_fast=args.fail_fast
        )
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()