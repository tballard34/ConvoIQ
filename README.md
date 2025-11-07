# ConvoIQ

AI-powered conversation analysis tool built with [Harper](https://www.harper.fast/).

## How it works

https://www.loom.com/share/56db97f4d2724ac3956f379ada78b730

## Description

Imagine it? Create it.

ConvoIQ is an innovative conversation intelligence platform that allows you to create custom dashboards through AI for any conversations.

Imagine you're a sales rep and you need to track your filler words. Or when the client shows buying intent. Or imagine you want a sales coach in your pocket to tell you your there biggest strengths and weaknesses on the call.

Or imagine you're a project manager and you want to know the three biggest takeaways you had from talking with a customer. Or what your follow-up items are.

All of these are possible with ConvoIQ.

## View live

https://convo-iq.trent-ballard-org.harperfabric.com/

## Installation

To get started, make sure you have [installed Harper](https://docs.harperdb.io/docs/deployments/install-harper), which can be done quickly:

```sh
npm install -g harperdb
```

Then install packages

```sh
npm install
```

## Local Development

### Env file setup
First copy the `.env.example` file to a `.env.local` file and set up env vars
```sh
cp .env.example .env.local
```

Now you will need a couple things
1. Setup an AWS bucket named `convoiq-convos-local`, give it correct CORS access and bucket policy
2. Setup an IAM user with S3AdminAccess policy and mint an s3 key, use this keys values in the `S3_ACCESS_KEY_ID` & `S3_SECRET_ACCESS_KEY` env vars
3. Create account and get a key from [Google DeepGram](https://deepgram.com/voice-ai-platform) (used for transcription). As of 11/6/2025 they give $200 in free credits when you create an account. Replace `DEEPGRAM_API_KEY` with your deepgram key
4. Create account and get a key from [Open Router](https://openrouter.ai/) (used for LLMs). As of 11/6/2025 tehy give $5 in free credits when you create an account. Replace `OPENROUTER_API_KEY` with your openrouter key

### Run
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

## Deploy to Prod

To Deploy look at Harpers docs to create an organization, cluster, and deploy to a cluster

[Harper docs](https://docs.harperdb.io/docs)
