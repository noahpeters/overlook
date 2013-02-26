var exec = require('child_process').exec;
var processes = function (callback) {
    exec('ps -x -o pid= -o command= | sed -e "s/^[ \t]*//"', function(err, stdout, stderr) {
        // stdout is a string containing the output of the command.
        // parse it and look for the apache and mysql processes.
        //callback(err, stdout, stderr);
        var pl = stdout;
        var procs = pl.split("\n");
        var obj = { };
        procs.forEach(function (proc) {
            var cols = proc.split(" ");
            obj[cols.shift()] = cols.join(" ");
        });
        if (typeof callback === "function") {
            callback(obj);
        }
    });
};
module.exports = processes;