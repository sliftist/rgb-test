const path = require("path");

module.exports = {
    mode: "development",
    entry: "./index",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
        libraryTarget: "umd"
    },
    devtool: "inline-source-map",
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".cpp", ".h"],
        alias: {
            fs: path.resolve(path.join(__dirname, "noop")),
            jimp: path.resolve(path.join(__dirname, "noop"))
        }
    },
    module: {
        rules: [
            { test: /\.less$/, loader: "style-loader!css-loader!less-loader" },
            { test: /\.css$/, loader: "style-loader!css-loader" },
            {
                // .ts, but NOT .d.ts
                test: /(([^d])|([^.]d)|(^d))\.tsx?$/, loader: "ts-loader",
                //test: /tsx?$/, loader: "ts-loader",
            },
            { test: /\.md?$/, loader: "load-as-text" },
            { test: /\.cpp$/, loader: "cpp-portable-loader?emitMapFile" },
            { test: /\.(png|svg|jpg|gif)$/, loader: "file-loader" }
        ]
    }
};



/*
module.exports = {
    mode: "development",
    entry: "./index",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
        libraryTarget: "umd"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".cpp", ".h"],
    },
    module: {
        rules: [
            { test: /\.cpp$/, loader: "cpp-portable-loader?emitMapFile" },
        ]
    }
};
*/