import * as preact from "preact";
import "./index.css";

import { observable } from "mobx";
import { observer } from "mobx-preact";

import { DecodeMP4, ParseNalInfo } from "mp4-typescript";

import * as Broadway from "broadway-player";

function getFrames(video: Buffer): ImageData[] {
    let frames: ImageData[] = [];
    
    let result = DecodeMP4(video);
    let player = new Broadway.Player({});
    let canvasCopy = document.createElement("canvas");
    let canvasContext: CanvasRenderingContext2D|null = null;
    player.onRenderFrameComplete = ({canvasObj, width, height}) => {
        if(!canvasContext || canvasCopy.width !== width || canvasCopy.height !== height) {
            canvasCopy.width = width;
            canvasCopy.height = height;
            canvasContext = canvasCopy.getContext("2d");
            if(!canvasContext) throw new Error(`Internal error`);
        }
        canvasContext.drawImage(canvasObj.canvas, 0, 0);

        let data = canvasContext.getImageData(0, 0, canvasObj.canvas.width, canvasObj.canvas.height).data;
        let bufferCopy = new Uint8ClampedArray(data.length);
        bufferCopy.set(data);
        frames.push({
            width,
            height,
            data: bufferCopy,
        });
    };

    let nalCount = 0;
    function addSample(buffer: Buffer) {
        let pos = 0;
        while(pos < buffer.length) {
            let size = buffer.readUInt32BE(pos);
            pos += 4;

            let nal = buffer.slice(pos, pos + size);
            pos += size;

            //console.log(ParseNalInfo(nal), frames.length, nalCount++, buffer.byteOffset + pos - size - 4);

            player.decode(nal);
        }
    }

    function getBox(boxes: any, typePath: string) {
        let typeArray = typePath.split(".");
        for(let i = 0; i < typeArray.length; i++) {
            for(let box of boxes.boxes) {
                if(box.type === typeArray[i]) {
                    boxes = box;
                    break;
                }
            }
        }
        return boxes;
    }
    let avcInfo = getBox(result, "moov.trak.mdia.minf.stbl.stsd.avc1.avcC");
    if(avcInfo.spses) {
        player.decode(avcInfo.spses[0].bytes.getBuffer(0).buffer);
    }
    if(avcInfo.ppses) {
        player.decode(avcInfo.ppses[0].bytes.getBuffer(0).buffer);
    }

    console.log(getBox(result, "moov.trak.mdia.minf.stbl.stsc"));

    let samplesToChunkList = getBox(result, "moov.trak.mdia.minf.stbl.stsc").entries;
    let chunkCountLookup: { [chunk: number]: number } = Object.create(null);
    let chunkIndex = 0;
    for(let i = 0; i < samplesToChunkList.length; i++) {
        let chunkCount = i < samplesToChunkList.length - 1 ? (samplesToChunkList[i + 1].first_chunk - samplesToChunkList[i].first_chunk) : 1;
        for(let k = 0; k < chunkCount; k++) {
            chunkCountLookup[chunkIndex++] = samplesToChunkList[i].samples_per_chunk;
        }
    }

    let chunk_offsets = getBox(result, "moov.trak.mdia.minf.stbl.stco").chunk_offsets;
    let sample_sizes = getBox(result, "moov.trak.mdia.minf.stbl.stsz").sample_sizes;

    let mdats: Buffer[] = result.boxes.filter((x: any) => x.type === "mdat").map((x: any) => x.bytes.getBuffer(0).buffer);
    let mdat = mdats[0];

    (async () => {
        // Assumes the chunks are in display order, and the frames within the chunks are in display order
        for(let i = 0; i < chunk_offsets.length; i++) {
            let chunkOffset = chunk_offsets[i];
            let sampleCount = chunkCountLookup[i] || chunkCountLookup[chunkIndex - 1];

            let offset = chunkOffset - mdat.byteOffset;
            for(let k = 0; k < sampleCount; k++) {
                // We need sample sizes, as chunk sizes are not directly stored.
                let sampleSize = sample_sizes[frames.length];
                addSample(mdat.slice(offset, offset + sampleSize));
                offset += sampleSize;

                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
        }
    })();

    return frames;
}

@observer
class Root extends preact.Component<{}, {}> {
    @observable.shallow state = {
        imageUrl: undefined as undefined|string,
        frameRate: 0,
        width: 0,
        height: 0
    };
    constructor() {
        super(...arguments);
        (async () => {
            let image = await new Promise<HTMLImageElement>(resolve => {
                let imageSizer = new Image();
                imageSizer.onload = () => resolve(imageSizer);
                imageSizer.src = "/assets/Axis_axis_(Nagarhole,_2010).jpg";
                imageSizer.src = "/assets/nyc.jpg";
            });


            //let videoUrl = "https://www.youtube.com/watch?v=E14WmbNFXv0";
            //let videoUrl = "https://www.youtube.com/watch?v=sVdGW37sbYw";
            let videoUrl = "https://www.youtube.com/watch?v=EBt_88nxG4c";
            let time = 70;
            let duration = 20;

            let url: string;
            {
                if((videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) && !videoUrl.startsWith("https://www.youtube.com/")) {
                    url = videoUrl;
                } else {
                    let videoId = new URL(videoUrl).searchParams.get("v");
                    if(!videoId) {
                        console.error(`Invalid video url ${videoUrl}`);
                        return;
                    }
                    url = `http://localhost:8070/${videoId}?s=${time}&t=${duration}&highres`;
                }
            }
            let video = await getRaw(url);
            
            let frames = getFrames(video);

            console.log(`Loaded frames`);

            
            let canvas = document.createElement("canvas");
            canvas.style.maxWidth = "100vw";
            canvas.style.maxHeight = "100vh";
            canvas.width = frames[0].width;
            canvas.height = frames[0].height;

            this.state.width = canvas.width;
            this.state.height = canvas.height;

            let contextBase = canvas.getContext("2d");
            if(!contextBase) throw new Error(`Internal error`);
            let context = contextBase;


            let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            let imageDataBase = new Uint8ClampedArray(imageData.data.length);
            imageDataBase.set(imageData.data);

            let f = 0;

            function setData(k: number) {
                f += 0.5;
                imageDataBase = frames[~~f % frames.length].data;

                for(let i = 0; i < imageData.data.length; i += 4) {
                    let r = imageDataBase[i];
                    let g = imageDataBase[i + 1];
                    let b = imageDataBase[i + 2];

                    let v = 0;
                    if(Math.abs(k - 0) <= 1) {
                        v += (1 - Math.abs(k - 0)) * r;
                    }
                    if(Math.abs(k - 1) <= 1) {
                        v += (1 - Math.abs(k - 1)) * g;
                    }
                    if(Math.abs(k - 2) <= 1) {
                        v += (1 - Math.abs(k - 2)) * b;
                    }
                    r = v;
                    g = v;
                    b = v;

                    imageData.data[i] = r;
                    imageData.data[i + 1] = g;
                    imageData.data[i + 2] = b;
                    imageData.data[i + 3] = 255;
                }
                context.putImageData(imageData, 0, 0);
            }

            //this.state.imageUrl = canvas.toDataURL();
            document.body.appendChild(canvas);

            let cur60Time = Date.now();
            let cur60Count = 0;
            while(true) {
                for(let k = 0; k <= 4; k += 0.2) {
                    for(let i = 0; i < 1; i++) {
                        await new Promise(resolve => requestAnimationFrame(resolve));
                    }
                    setData(Math.abs(k - 2));
                    cur60Count++;
                    if(cur60Count >= 60) {
                        this.state.frameRate = 1000 / (Date.now() - cur60Time) * 60;
                        cur60Time = Date.now();
                        cur60Count = 0;
                    }
                }
            }
        })();
    }
    render() {
        let { frameRate, width, height } = this.state;
        return (
            <preact.Fragment>
                <h1>{frameRate.toFixed(1)} ({width}x{height})</h1>
            </preact.Fragment>
        );
    }
}

function send(url: string): void {
    var request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.send();
}

function get(url: string): any {
    var request = new XMLHttpRequest();
    request.open("GET", url, false);
    request.send();
    return JSON.parse(request.responseText);
}
function getRaw(url: string): any {
    var request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "arraybuffer";
    request.send();
    return new Promise(resolve => request.onload = () => resolve(Buffer.from(request.response)));
}
function getHeaders(url: string): XMLHttpRequest {
    var request = new XMLHttpRequest();
    request.open("HEAD", url, false);
    request.send();
    return request;
}


declare var root: HTMLElement;
preact.render(<Root />, root);