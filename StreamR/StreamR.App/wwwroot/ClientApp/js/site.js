let connection;

async function startAsync() {
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/stream", { /*logMessageContent: true,*/ logger: signalR.LogLevel.Information })
        .build();

    let closed = false;
    let isStreaming = false;
    let facingMode = "user";
    let subject;
    connection.onclose(function (err) {
        closed = true;
        if (isStreaming === true) {
            subject.complete();
            camera.stop();
            isStreaming = false;
        }
    });

    connection.on("NewStream", function (name) {
        addStream(name);
    });

    connection.on("RemoveStream", function (name) {
        removeStream(name);
    });

    await connection.start();

    const streams = await connection.invoke("ListStreams");
    if (streams.length > 0) {
        for (let i = 0; i < streams.length; i++) {
            addStream(streams[i]);
        }
    }

    const startStreamButton = document.getElementById('startStream');
    const stopStreamButton = document.getElementById('stopStream');
    const swapCameraButton = document.getElementById('swapCamera');
    const asciiCanvas = document.getElementById("myPre");
    
    stopStreamButton.onclick = function () {
        stopStreamButton.setAttribute("disabled", "disabled");
        swapCameraButton.setAttribute("disabled", "disabled");
        startStreamButton.removeAttribute("disabled");
        if (isStreaming === true) {
            subject.complete();
            camera.stop();
            isStreaming = false;
		}
		removeStream(streamName);
    }
    startStreamButton.onclick = async function () {
        startStreamButton.setAttribute("disabled", "disabled");
        stopStreamButton.removeAttribute("disabled");
        swapCameraButton.removeAttribute("disabled");
        let streamName = document.getElementById("streamName").value;

        subject = new signalR.Subject();

        startCamera();

        if (streamName === "") {
            streamName = "random name " + Math.random() * 2;
        }
		await connection.send("StartStream", streamName, subject);
		addStream(streamName);
    }

    swapCameraButton.onclick = async function () {
        if (facingMode === "user") {
            facingMode = "enironment";
        } else {
            facingMode = "user";
        }

        startCamera();
    };

    function startCamera() {
        camera.init({
            width: 120,
            height: 90,
            fps: 30,
            mirror: true,
            facingMode,
            targetCanvas: document.getElementById("myCanvas"),

            onFrame: function (canvas) {
                ascii.fromCanvas(canvas, {
                    contrast: 170,
                    callback: function (asciiString) {
                        subject.next(asciiString);
                        asciiCanvas.innerHTML = asciiString;
                    }
                });
            },

            onSuccess: function () {
                isStreaming = true;
            },

            onError: function (error) {
                console.log(error);
            }
        });
    }
}

startAsync();

async function watchStream(streamName) {
    const watchBtn = document.getElementById("button " + streamName);
    watchBtn.setAttribute("disabled", "disabled");
    const closeBtn = document.getElementById("button close " + streamName);
    closeBtn.removeAttribute("disabled");

    const feed = document.getElementById("myPre");

    const ISub = connection.stream("WatchStream", streamName).subscribe({
        next: (item) => {
            feed.innerHTML = item;
        },
        complete: () => {
            feed.innerHTML = "Stream completed";
            console.log("Stream is finished.");
        },
        error: (err) => {
            feed.innerHTML = "Stream closed with an error";
            console.log("Failed to watch the stream: " + err);
        },
    });

    closeBtn.onclick = function () {
        ISub.dispose();
        closeBtn.setAttribute("disabled", "disabled");
        watchBtn.removeAttribute("disabled");
    };
}

function addStream(streamName) {
    const list = document.getElementById('streamList');
    const listBody = list.getElementsByTagName('ul')[0];
    if (listBody.children[0].innerHTML === "No streams available") {
        // Clear the list
        listBody.innerHTML = '';
    }

    const strmButton = document.createElement('input');
    strmButton.id = "button " + streamName;
    strmButton.type = "button";
    strmButton.value = "Watch stream";
    strmButton.onclick = function () { watchStream(streamName); };

    const strmEndButton = document.createElement('input');
    strmEndButton.id = "button close " + streamName;
    strmEndButton.type = "button";
    strmEndButton.value = "Stop watching stream";
    strmEndButton.setAttribute("disabled", "disabled");

    const elem = document.createElement('li');
    elem.id = "li " + streamName;
    elem.innerText = streamName;
    elem.appendChild(strmButton);
    elem.appendChild(strmEndButton);
    listBody.appendChild(elem);
}

function removeStream(streamName) {
    const list = document.getElementById('streamList');
    const listBody = list.getElementsByTagName('ul')[0];
    if (listBody.children.length === 1) {
        listBody.innerHTML = '';
        const elem = document.createElement('li');
        elem.innerText = "No streams available";
        listBody.appendChild(elem);
        return;
    }

    const li = document.getElementById("li " + streamName);
    listBody.removeChild(li);
}