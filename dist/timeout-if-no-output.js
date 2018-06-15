"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = __importStar(require("child_process"));
const minimist_1 = __importDefault(require("minimist"));
const argv = minimist_1.default(process.argv.slice(2), {
    string: ["timeout"],
    alias: { t: "timeout" },
    stopEarly: true
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
        process.stderr.write(`No output received from subprocess in ${timeout}ms, quitting...`);
        process.exit(1);
    }
}, timeout / 3);
//# sourceMappingURL=timeout-if-no-output.js.map