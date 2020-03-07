const child_process = require("child_process");
const child_process_promise = require("child-process-promise");
const fs = require("fs");

// TODO: https://letsencrypt.org/getting-started/

// require("ffmpeg-npm")

// python "C:/Users/quent/Dropbox/repos/new-site/youtube-dl/youtube_dl/__main__.py" https://www.youtube.com/watch?v=nt-unq5i_oU -g
// ffmpeg -hide_banner -ss 00:10:00 -i "$()" -c copy -t 00:00:10 -y C:/Users/quent/Dropbox/repos/new-site/youtube-dl/seg.mp4

// "C:\Program Files\Git\mingw64\bin\openssl.exe" req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
// openssl x509 -outform der -in cert.pem -out cert.crt 

const https = require('http');

const options = {
    
};

function binarySearch(list, value, comparer) {
    let minIndex = 0;
    let maxIndex = list.length;

    while (minIndex < maxIndex) {
        let fingerIndex = ~~((maxIndex + minIndex) / 2);
        //if (fingerIndex >= list.length) return ~fingerIndex;
        let finger = list[fingerIndex];
        let comparisonValue = comparer(value, finger);
        if(comparisonValue < 0) {
            maxIndex = fingerIndex;
        } else if(comparisonValue > 0) {
            minIndex = fingerIndex + 1;
        } else {
            return fingerIndex;
        }
    }
    return ~minIndex;
}

function formatTime(time) {
    let seconds = time % 60;
    time -= seconds;
    time = time / 60;
    let minutes = time % 60;
    time -= minutes;
    time = time / 60;
    let hours = time % 60;
    time -= hours;
    time = time / 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

let availableNumbers = [];
let nextNumber = 0;
async function getNextNumber(code) {
    let curNumber = 0;
    if(availableNumbers.length > 0) {
        curNumber = availableNumbers.shift();
    } else {
        curNumber = nextNumber++;
    }

    try {
        await code(curNumber);
    } finally {
        let index = binarySearch(availableNumbers, curNumber, (lhs, rhs) => lhs - rhs);
        if(index >= 0) throw new Error(`Impossible, duplicate number`);
        availableNumbers.splice(~index, 0, curNumber);
    }
}

https.createServer(options, async function (req, res) {
    console.log(req.url);

    if(req.url === "/favicon.ico") {
        res.writeHead(404);
        res.end();
        return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    if(req.url === "/topvideos") {
        let httpResult = await new Promise(resolve => https.get("https://www.youtube.com", res => resolve(res)));

        let data = "";
        httpResult.on("data", chunk => {
            data += chunk;
        });

        await new Promise(resolve => {
            httpResult.on("end", () => {
                resolve();
            });
        });

        let results = {};
        let regex = new RegExp("\"/watch\\?v=([a-zA-Z\-_]+)\"", "g");
        while(true) {
            let result = regex.exec(data);
            if(!result) break;
            results[result[1]] = true;
        }

        res.writeHead(httpResult.statusCode);
        res.write(JSON.stringify(Object.keys(results)));
        res.end();
        return;
    }

    res.setHeader("Cache-Control", "public, max-age=315360000");

    let url = new URL(`http://example.com${req.url}`);

    let startTime = parseFloat(url.searchParams.get("s")) || 0;
    let duration = parseFloat(url.searchParams.get("t")) || 0;

    if(startTime < 0) startTime = 0;

    try {
        let videoId = Buffer.from(url.pathname.slice(1).replace(/-/g, "+").replace(/\//g, "_"), "base64").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

        let resParam = "";
        if(url.searchParams.get("highres") === null) {
            resParam = `-f "bestvideo[height<=480][ext=mp4]"`;
        } else {
            resParam = `-f bestvideo[ext=mp4]`;
        }

        let downloadCommand = `python "./youtube-dl/youtube_dl/__main__.py" ${resParam} https://www.youtube.com/watch?v=${videoId} -g`;

        console.log(downloadCommand);

        let videoUrl = await child_process_promise.exec(downloadCommand);

        await getNextNumber(async num => {
            let fileName = `temp${num}.mp4`;

            // (muxer does not support non seekable output, so we need to use a file)
            let ffmpegCommand = `ffmpeg -hide_banner -ss ${formatTime(startTime)} -i "${videoUrl.stdout.split(/(\r\n|\n|\r)/)[0]}" -bt 10M -vcodec libx264 -pass 1 -coder 0 -bf 0 -flags -loop -wpredp 0 -t ${formatTime(duration)} ${fileName} -y`;

            console.log(ffmpegCommand);

            await child_process_promise.exec(ffmpegCommand, { encoding: "buffer", maxBuffer: 1024 * 1024 * 20 });

            videoOutput = await new Promise((resolve, reject) => {
                fs.readFile(fileName, (err, data) => {
                    if(err) reject(err);
                    else resolve(data);
                });
            });
        });

        res.setHeader("Content-Type", "video/mp4");
        res.writeHead(200);

        res.write(videoOutput);

    } catch(e) {
        res.writeHead(500);
        res.write(e.toString());
    }

    res.end();
}).listen(8070);
console.log("Listening on port 8070");