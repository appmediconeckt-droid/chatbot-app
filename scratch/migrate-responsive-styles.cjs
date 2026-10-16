const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function migrate(file, styleName, derivedNames = []) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const changes = [];
  let program;
  traverse(ast, { Program(path) { program = path; } });
  const dimensionDecl = program.get('body').find(path => path.isVariableDeclaration()
    && path.node.declarations.some(decl => decl.id.type === 'ObjectPattern'
      && source.slice(decl.init?.start, decl.init?.end).includes('Dimensions.get')));
  if (!dimensionDecl) throw new Error(`No dimension declaration: ${file}`);
  const aliases = dimensionDecl.node.declarations[0].id.properties.map(prop => [prop.key.name, prop.value.name]);
  const derived = derivedNames.map(name => program.scope.getBinding(name));
  const binding = program.scope.getBinding(styleName);
  if (!binding) throw new Error(`No styles: ${file}`);
  const dimensionsAndStyles = [...aliases.map(([, name]) => name), ...derivedNames, styleName];
  const components = new Map();
  for (const name of dimensionsAndStyles) {
    for (const ref of program.scope.getBinding(name).referencePaths) {
      let owner = ref.getFunctionParent();
      if (!owner) continue;
      while (owner.getFunctionParent()) owner = owner.getFunctionParent();
      const id = owner.node.id?.name || owner.parentPath.node.id?.name;
      if (!id || !/^[A-Z]/.test(id)) throw new Error(`Non-component reference ${name} in ${id}: ${file}`);
      if (!components.has(owner)) components.set(owner, new Set());
      components.get(owner).add(name);
    }
  }
  const factory = `make${styleName === 's' || styleName === 'S' ? 'ResponsiveStyles' : 'ResponsiveScreenStyles'}`;
  changes.push([dimensionDecl.node.start, dimensionDecl.node.end, '']);
  derived.forEach(item => changes.push([item.path.parentPath.node.start, item.path.parentPath.node.end, '']));
  const params = [...aliases.map(([, name]) => name), ...derivedNames];
  changes.push([binding.path.node.id.start, binding.path.node.id.end, factory]);
  changes.push([binding.path.node.init.start, binding.path.node.init.start, `(${params.join(', ')}) => `]);
  for (const [component, names] of components) {
    const fields = [...names].join(', ');
    const body = component.node.body;
    if (body.type !== 'BlockStatement') {
      const arrow = source.indexOf('=>', component.node.start);
      changes.push([arrow + 2, component.node.end, ` {\n  const { ${fields} } = useResponsiveScreenStyles();\n  return (${source.slice(body.start, body.end)});\n}`]);
    } else {
      changes.push([body.start + 1, body.start + 1, `\n  const { ${fields} } = useResponsiveScreenStyles();`]);
    }
  }
  const aliasesCode = aliases.map(([key, name]) => key === name ? name : `${key}: ${name}`).join(', ');
  const derivedCode = derived.map(item => source.slice(item.path.parentPath.node.start, item.path.parentPath.node.end)).join('\n  ');
  const hook = `\nfunction useResponsiveScreenStyles() {\n  const { ${aliasesCode} } = useResponsiveWindowDimensions();\n  ${derivedCode}\n  const ${styleName} = useResponsiveStylesMemo(() => ${factory}(${params.join(', ')}), [${params.join(', ')}]);\n  return { ${dimensionsAndStyles.join(', ')} };\n}\n`;
  let output = source;
  changes.sort((a, b) => b[0] - a[0]).forEach(([start, end, text]) => { output = output.slice(0, start) + text + output.slice(end); });
  output = output.replace(/\bDimensions,?\s*\r?\n/, '');
  // Single-line native imports need a separate removal.
  output = output.replace(/, Dimensions(?=\s*})/, '');
  output = `import { useMemo as useResponsiveStylesMemo } from 'react';\nimport { useWindowDimensions as useResponsiveWindowDimensions } from 'react-native';\n${output.replace(/^\uFEFF/, '')}${hook}`;
  parser.parse(output, { sourceType: 'module', plugins: ['jsx'] });
  fs.writeFileSync(file, output);
  process.stdout.write(`${file}: ${components.size} responsive components\n`);
}

migrate('src/screens/user/Component/UserDashboard/Tab/Counselor/CounselorDirectory.jsx', 'styles');
migrate('src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput.jsx', 'styles');
migrate('src/screens/user/Component/counselor-dashboard/Tab/Settings/CounselorSettings.jsx', 'styles', ['isTablet']);
migrate('src/screens/user/Component/counselor-dashboard/Tab/Profile-Con/CounselorProfile.jsx', 'styles');
migrate('src/screens/auth/DoctorOnboarding.jsx', 's', ['HERO_SIZE']);
migrate('src/screens/user/Component/PatientProfile/AvatarGenerator.jsx', 'S', ['ITEM_SIZE']);
