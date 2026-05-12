import re
with open(r'src\screens\user\Component\counselor-dashboard\Dashboard\dashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
# Replace all variations of smart quotes with regular quotes
content = content.replace('"', '"')
content = content.replace('"', '"')
content = content.replace(''', "'")
content = content.replace(''', "'")
with open(r'src\screens\user\Component\counselor-dashboard\Dashboard\dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed all smart quotes')
