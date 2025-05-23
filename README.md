# TikTok-Chat-Reader
A chat reader for <a href="https://www.tiktok.com/live">TikTok LIVE</a> utilizing <a href="https://github.com/zerodytrash/TikTok-Live-Connector">TikTok-Live-Connector</a> and <a href="https://socket.io/">Socket.IO</a> to forward the data to the client. This demo project uses the unofficial TikTok API to retrieve chat comments, gifts and other events from TikTok LIVE.

## Demo: https://tiktok-chat-reader.zerody.one/

## Installation
To run the chat reader locally, follow these steps:

1. Install [Node.js](https://nodejs.org/) on your system
2. Clone this repository or download and extract [this ZIP file](https://github.com/zerodytrash/TikTok-Chat-Reader/archive/refs/heads/main.zip)
3. Open a console/terminal in the root directory of the project
4. Enter `npm i` to install all required dependencies 
5. Enter `node server.js` to start the application server

Now you should see the following message: `Server running! Please visit http://localhost:8091`<br>
Simply open http://localhost:8091/ in your browser. Thats it.

If you have problems with Node.js, you can also just open the `index.html` from the `public` folder.<br>
This will use the server backend of the [demo site](https://tiktok-chat-reader.zerody.one/), which is sufficient for testing purposes. If you want to offer it to others or make many connections at the same time, please consider using your own server.

## Screenshot

![TikTok LIVE Chat Reader (Demo)](https://user-images.githubusercontent.com/59258980/153956504-c585b14b-a50e-43f0-a994-64adcaface2e.png)

## Docker

This application can be built and run as a Docker container.

### Building the Image

To build the Docker image, navigate to the project's root directory (where the `Dockerfile` is located) and run:

```sh
docker build -t tiktok-live-connector-app .
```

### Running the Container

To run the Docker container:

```sh
docker run -p 8081:8081 --env-file .env tiktok-live-connector-app
```

Or if you don't want to use an .env file, you can pass environment variables directly:

```sh
docker run -p 8081:8081 \
  -e PORT=8081 \
  -e SESSIONID="your_session_id_here" \
  -e ENABLE_RATE_LIMIT="true_or_false" \
  tiktok-live-connector-app
```

**Note:**
*   Replace `"your_session_id_here"` with your actual TikTok session ID if you intend to use it.
*   The `PORT` environment variable inside the container is set by the `EXPOSE` instruction in the Dockerfile and the `CMD` instruction. The first `8081` in `-p 8081:8081` is the host port you want to map to the container's exposed port.
*   `ENABLE_RATE_LIMIT` is optional and can be set to `true` or `false`.

### Environment Variables

The following environment variables can be used to configure the application when running the Docker container:

*   `PORT`: The port on which the application server will listen (default: `8081`).
*   `SESSIONID`: (Optional) Your TikTok session ID.
*   `ENABLE_RATE_LIMIT`: (Optional) Set to `true` to enable rate limiting for connections.
