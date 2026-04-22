const fs = require('fs');
const files = [
  'src/screens/user/Component/counselor-dashboard/Tab/Profile-Con/CounselorProfile.jsx',
  'src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx',
  'src/screens/auth/Landing.jsx'
];
files.forEach(p => {
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf-8');
  let changed = false;
  content = content.replace(/<TextInput([^>]*?)placeholder=([\'\"].*?[\'\"])([^>]*?)>/g, (match, p1, p2, p3) => {
    if (match.includes('placeholderTextColor')) return match;
    changed = true;
    return '<TextInput' + p1 + 'placeholder=' + p2 + ' placeholderTextColor=\"#94a3b8\"' + p3 + '>';
  });
  if (changed) {
    fs.writeFileSync(p, content);
    console.log('Fixed', p);
  }
});
