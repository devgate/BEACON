#!/usr/bin/env python3
"""
Morphik Test Validation
Validates test files and their structure without running them
"""
import ast
import inspect
import importlib.util
import sys
from pathlib import Path


def validate_test_file(file_path):
    """Validate a single test file"""
    print(f"\n📋 Validating {file_path.name}")
    print("=" * 40)
    
    issues = []
    warnings = []
    
    try:
        # Parse AST
        with open(file_path, 'r') as f:
            content = f.read()
        
        tree = ast.parse(content)
        
        # Count test functions and classes
        test_functions = 0
        test_classes = 0
        test_methods = 0
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name.startswith('test_'):
                test_functions += 1
            elif isinstance(node, ast.ClassDef):
                if node.name.startswith('Test'):
                    test_classes += 1
                    # Count methods in test classes
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef) and item.name.startswith('test_'):
                            test_methods += 1
        
        print(f"✅ Syntax: Valid")
        print(f"📊 Test Classes: {test_classes}")
        print(f"📊 Test Methods: {test_methods}")
        print(f"📊 Test Functions: {test_functions}")
        
        # Check for required imports
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        
        required_imports = ['pytest', 'unittest.mock']
        missing_imports = []
        for req_import in required_imports:
            if not any(req_import in imp for imp in imports):
                missing_imports.append(req_import)
        
        if missing_imports:
            warnings.append(f"Missing recommended imports: {missing_imports}")
        
        # Check for fixture usage
        has_fixtures = 'pytest.fixture' in content or '@pytest.fixture' in content
        if test_classes > 0 and not has_fixtures:
            warnings.append("Consider using pytest fixtures for better test organization")
        
        # Check for mock usage
        has_mocks = 'Mock' in content or '@patch' in content
        if test_methods > 0 and not has_mocks:
            warnings.append("Tests may benefit from mocking external dependencies")
        
        if warnings:
            print("\n⚠️  Warnings:")
            for warning in warnings:
                print(f"   - {warning}")
        
    except SyntaxError as e:
        issues.append(f"Syntax error: {e}")
    except Exception as e:
        issues.append(f"Validation error: {e}")
    
    if issues:
        print("\n❌ Issues:")
        for issue in issues:
            print(f"   - {issue}")
        return False
    else:
        print("✅ Validation passed!")
        return True


def validate_test_structure():
    """Validate overall test structure"""
    print("\n🏗️  Test Structure Validation")
    print("=" * 40)
    
    backend_dir = Path(__file__).parent
    test_files = [
        'test_morphik_service.py',
        'test_morphik_api.py',
        'test_morphik_integration.py'
    ]
    
    missing_files = []
    existing_files = []
    
    for test_file in test_files:
        file_path = backend_dir / test_file
        if file_path.exists():
            existing_files.append(file_path)
        else:
            missing_files.append(test_file)
    
    if missing_files:
        print(f"❌ Missing test files: {missing_files}")
        return False
    else:
        print(f"✅ All test files present: {len(existing_files)} files")
    
    # Check source files exist
    source_files = [
        'services/morphik_service.py',
        'api/morphik.py'
    ]
    
    missing_source = []
    for source_file in source_files:
        source_path = backend_dir / source_file
        if not source_path.exists():
            missing_source.append(source_file)
    
    if missing_source:
        print(f"❌ Missing source files: {missing_source}")
        return False
    else:
        print("✅ All source files present")
    
    return existing_files


def check_import_compatibility():
    """Check if imports work correctly"""
    print("\n🔗 Import Compatibility Check")
    print("=" * 40)
    
    try:
        # Test morphik_service import
        import services.morphik_service
        print("✅ services.morphik_service imports successfully")
        
        # Check key classes exist
        assert hasattr(services.morphik_service, 'MorphikService')
        assert hasattr(services.morphik_service, 'MorphikError')
        assert hasattr(services.morphik_service, 'create_morphik_service')
        print("✅ MorphikService classes available")
        
    except Exception as e:
        print(f"❌ Error importing morphik_service: {e}")
        return False
    
    try:
        # Test morphik API import
        import api.morphik
        print("✅ api.morphik imports successfully")
        
        # Check key components exist
        assert hasattr(api.morphik, 'morphik_bp')
        assert hasattr(api.morphik, 'init_morphik_module')
        print("✅ Morphik API components available")
        
    except Exception as e:
        print(f"❌ Error importing morphik API: {e}")
        return False
    
    try:
        # Test Flask app import
        import app
        print("✅ Flask app imports successfully")
        
    except Exception as e:
        print(f"❌ Error importing Flask app: {e}")
        return False
    
    return True


def generate_test_summary():
    """Generate test summary"""
    print("\n📈 Test Suite Summary")
    print("=" * 40)
    
    backend_dir = Path(__file__).parent
    test_files = [
        ('test_morphik_service.py', 'Unit Tests - MorphikService class'),
        ('test_morphik_api.py', 'API Tests - Flask blueprint endpoints'),
        ('test_morphik_integration.py', 'Integration Tests - End-to-end workflows')
    ]
    
    total_classes = 0
    total_methods = 0
    
    for test_file, description in test_files:
        file_path = backend_dir / test_file
        if file_path.exists():
            print(f"\n📄 {test_file}")
            print(f"   Purpose: {description}")
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                tree = ast.parse(content)
                
                classes = 0
                methods = 0
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.ClassDef) and node.name.startswith('Test'):
                        classes += 1
                        for item in node.body:
                            if isinstance(item, ast.FunctionDef) and item.name.startswith('test_'):
                                methods += 1
                
                total_classes += classes
                total_methods += methods
                
                print(f"   Test Classes: {classes}")
                print(f"   Test Methods: {methods}")
                
            except Exception as e:
                print(f"   Error analyzing file: {e}")
    
    print(f"\n🎯 Total Test Coverage:")
    print(f"   Test Classes: {total_classes}")
    print(f"   Test Methods: {total_methods}")
    print(f"   Coverage Areas: Unit, API, Integration")
    
    return total_classes, total_methods


def main():
    """Main validation function"""
    print("🧪 Morphik Test Suite Validation")
    print("=" * 50)
    
    # Validate test structure
    test_files = validate_test_structure()
    if not test_files:
        print("\n❌ Test structure validation failed!")
        return False
    
    # Check imports
    if not check_import_compatibility():
        print("\n❌ Import compatibility check failed!")
        return False
    
    # Validate individual test files
    all_valid = True
    for test_file in test_files:
        if not validate_test_file(test_file):
            all_valid = False
    
    # Generate summary
    total_classes, total_methods = generate_test_summary()
    
    print(f"\n{'='*50}")
    if all_valid:
        print("✅ All tests validated successfully!")
        print(f"🎉 Ready to run {total_classes} test classes with {total_methods} test methods")
        print("\nNext steps:")
        print("   1. Install pytest: pip install pytest pytest-cov")
        print("   2. Run tests: python run_morphik_tests.py test")
        print("   3. View coverage: open htmlcov_morphik/index.html")
    else:
        print("❌ Test validation failed!")
        print("Please fix the issues above before running tests.")
    
    return all_valid


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)