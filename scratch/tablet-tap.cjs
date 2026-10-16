const grpc = require('@grpc/grpc-js');
const loader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const proto = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/emulator/lib/emulator_controller.proto');
const api = grpc.loadPackageDefinition(loader.loadSync(proto)).android.emulation.control;
const client = new api.EmulatorController('127.0.0.1:8560', grpc.credentials.createInsecure());
const metadata = new grpc.Metadata();
const running = path.join(process.env.TEMP, 'avd/running');
for (const name of fs.readdirSync(running).filter(name => name.endsWith('.ini'))) {
  const config = fs.readFileSync(path.join(running, name), 'utf8');
  if (!config.includes('5560')) continue;
  const token = config.match(/^grpc\.token=(.*)$/m)?.[1]?.trim();
  if (token) metadata.set('authorization', `Bearer ${token}`);
}
const send = (x, y, pressure) => new Promise((resolve, reject) => {
  client.sendTouch({ touches: [{ x, y, identifier: 0, pressure }], display: 0 }, metadata, { deadline: Date.now() + 5000 }, (error, result) => error ? reject(error) : resolve(result));
});
(async () => {
  const [x, y] = process.argv.slice(2).map(Number);
  await send(x, y, 1);
  await new Promise(resolve => setTimeout(resolve, 150));
  await send(x, y, 0);
  process.stdout.write('Tablet tap delivered.\n');
})().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }).finally(() => client.close());
