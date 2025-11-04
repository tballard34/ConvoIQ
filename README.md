# ConvoIQ

AI-powered conversation analysis tool built with [Harper](https://www.harper.fast/).

## Installation

To get started, make sure you have [installed Harper](https://docs.harperdb.io/docs/deployments/install-harper), which can be done quickly:

```sh
npm install -g harperdb
```

## Development

Then you can start your app:
```sh
npm run dev
```

Test your application works by querying the `/Greeting` endpoint:

```sh
curl http://localhost:9926/Greeting
```

You should see the following:

```json
{"greeting":"Hello, world!"}
```

Navigate to [http://localhost:9926](http://localhost:9926) in a browser and view the functional web application.

## Deployment

Below is the live site
```
https://trent-hacks.trent-ballard-org.harperfabric.com/
```

You can [deploy via CLI to your own cluster](https://docs.harperdb.io/docs/getting-started/quickstart#deploy-to-fabric) or via the Harper Fabric UI

For this project, I'll be using the URL above
