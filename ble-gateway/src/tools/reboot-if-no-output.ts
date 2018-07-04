import * as child_process from "child_process";
import parseArgs from "minimist";

const argv = parseArgs(process.argv.slice(2), {
  string: ["timeout"],
  alias: { t: "timeout"},
  stopEarly: true,
});

const timeout = parseInt(argv.timeout, 10);
const command = argv._[0];
const commandArguments = argv._.slice(1);
let mostRecentTime = new Date();
const child = child_process.execFile(command, commandArguments);

// use event hooks to provide a callback to execute when data are available:
child.stdout.on("data", (data) => {
  mostRecentTime = new Date();
  process.stdout.write(data.toString());
});

child.stderr.on("data", (data) => {
  mostRecentTime = new Date();
  process.stderr.write(data.toString());
});

child.on("exit", (code) => {
  process.exit(code);
});

setInterval(() => {
  if (((new Date()).valueOf() - mostRecentTime.valueOf()) > timeout) {
    process.stderr.write(`No output received from subprocess in ${timeout}ms, restarting...`);
    child.kill("SIGINT");
    child_process.exec(`curl -X POST --header "Content-Type:application/json"
    --data '{"force": true}'
    "${process.env.RESIN_SUPERVISOR_ADDRESS}/v1/update?apikey=${process.env.RESIN_SUPERVISOR_API_KEY}"`, (error, stdout, stderr) => {
      process.stderr.write(stderr);
      process.stdout.write(stdout);
      if (error) {
        process.stderr.write("Error issuing reboot command: " + error);
      }
      process.exit(1);
    });
  }
}, timeout / 3);
