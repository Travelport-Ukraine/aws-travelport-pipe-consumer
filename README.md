# Travelport Pipe data consumer for AWS users

## Introduction

[eStreaming Pipe](https://docs.google.com/presentation/d/1hLTIOt1COWg2e4d0YgXLRTYSQROewWzd/edit?usp=sharing&ouid=110775096279309441076&rtpof=true&sd=true) is one of [Travelport](https://www.travelport.com) cache product family. It is a push service that allows receiving copies of replies to all travel agencies' shopping requests processed across the World.

## Solution overview

This is an example of eStreaming pipe consumer with AWS Endpoint Service for eStreaming Pipe. Some of our customers fill difficulties during the setup of infrastructure required to receive eStreaming data. Especially when it comes to AWS-to-AWS connection. This open-source project allows you to set up the necessary environment in a few simple steps. The resulting infrastructure requires no action to scale up & down. The project is built by following all best practices ready to work with a very high load.

The project is using AWS Fully Managed Services _only_. So you should not think about operating systems, physical or virtual machines, or underlying software. All patching, updates, provisioning, scaling, backups, etc will be done for you under the hood.

Fill free to use this project as a starting point to build your eStreaming data processing solution on AWS. For the sake of demonstration is reserving the data, recompress it into GZIP, and store it on S3. You should replace [this example function](https://github.com/Travelport-Ukraine/aws-travelport-pipe-consumer/blob/e986a3fc312df3740ca6899ec23dd2e202f0b0c9/src/docker/server.js#L50) with your data processing algorithm.

## Disclaimer

### AWS infrastructure

This project will create AWS resources for you. These resources could (and most probably will) cause some charges. **By using this product you are automatically confirming that you are absolutely aware of AWS services costs and you are ready to cover any related costs.** You can check which AWS resources were created after installation in the corresponding [AWS CloudFormation](https://aws.amazon.com/cloudformation/?nc1=h_ls) stack or use `cdk synth` command to check the proposed stack before installation.

### Processing code

[This example function](https://github.com/Travelport-Ukraine/aws-travelport-pipe-consumer/blob/e986a3fc312df3740ca6899ec23dd2e202f0b0c9/src/docker/server.js#L50) is written for the sake of demonstration. It should not be used in a production environment. In a real scenario, it is not the best idea to store each request to S3 using the individual `s3.upload` method. Your data load could be as high as thousand requests per second 24x7. So such many individual S3 requests could be [pretty costly](https://aws.amazon.com/s3/pricing/?nc1=h_ls) for you.

## Prerequisites

To run this product you supposed you have [AWS Account](https://aws.amazon.com/).

To run the project following software is to be installed:

* [Node.JS](https://nodejs.org/uk/download/)
* AWS CLI - [installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)
* [Docker](https://docs.docker.com/desktop/)

## Infrastructure setup

This project is using [AWS Cloud Development Kit](https://aws.amazon.com/cdk/) to orchestrate infrastructure. So you should install and bootstrap it. From here we assume that you are using the default AWS profile in AWS SDK. If you have multiple profiles, please refer to [AWS CDK documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html).

### AWS Cloud Development Kit install

Go to  project root directory and run following commands

```bash
cd cdk
npm install -g aws-cdk
cdk --version
```

### AWS Cloud Development Kit bootstrap

Change `ACCOUNT-NUMBER` to your AWS account id before run

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/eu-west-1
```

### Project deployment

Check AWS CloudFormation stack which will be deployed

```bash
cdk synth
```

If you are happy with proposed infrastructure deploy it to your account using

```bash
cdk deploy
```

Please send AWS CloudFormation output to us to start data transmission. 
## Update project

Feel free to update processing server code `src/docker/server.js` or infrastructure code `cdk/lib/aws-travelport-pipe-consumer-stack.ts`.

Then you can review changes:

```bash
cd cdk
cdk diff
```

and deploy them

```bash
cdk deploy
```

## Fargate Spot capacity provider

For the sake of simplicity, CDK pattern is used in the project. It uses a Fargate capacity provider. However, you can [save](https://aws.amazon.com/fargate/pricing/) about 70% of the cost if you will use [Fargate Spot](https://aws.amazon.com/blogs/compute/deep-dive-into-fargate-spot-to-run-your-ecs-tasks-for-up-to-70-less/) capacity provider. Server code is absolutely ready to run on Spot capacity. So feel free to update infrastructure code `cdk/lib/aws-travelport-pipe-consumer-stack.ts` to switch to [Fargate Spot Capacity provider](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html).

