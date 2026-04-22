import os
import re

def check_stylesheet_imports(directory):
    print(f"Checking directory: {directory}")
    found_any = False
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.jsx', '.js', '.tsx', '.ts')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if 'StyleSheet' in content:
                            # Check if imported from react-native (handles multi-line)
                            import_pattern = r"import\s+\{[^}]*StyleSheet[^}]*\}\s+from\s+['\"]react-native['\"]"
                            if not re.search(import_pattern, content, re.DOTALL):
                                print(f"ALERT: {path} - StyleSheet used but might be missing import")
                                found_any = True
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    if not found_any:
        print("No issues found.")
    print("Check complete.")

check_stylesheet_imports(r'c:\Users\vsing\OneDrive\Desktop\New folder (4)\chatbots\src')
