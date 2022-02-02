/* eslint-disable import/prefer-default-export */
// import * as cdk from '@aws-cdk/core';
// import * as ec2 from '@aws-cdk/aws-ec2';
// import * as ecs from '@aws-cdk/aws-ecs';
// import * as iam from '@aws-cdk/aws-iam';
// import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
// import * as s3 from '@aws-cdk/aws-s3';
// import { Peer, Vpc } from '@aws-cdk/aws-ec2';
import { Construct } from 'constructs';
import { Stack, StackProps, Tags, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_ecs as ecs, aws_ecs_patterns as ecsPatterns, aws_elasticloadbalancingv2 as elb2, aws_iam as iam, aws_logs as cwl, aws_s3 as s3 } from 'aws-cdk-lib';

// eStreaming Pipe data provider AWS Account number
const ENDPOINT_ALLOWED_PRINCIPAL = '408064982279';
const ELB_PORT = 80;
const CONTAINER_PORT = 8080;

const appPrefix = 'tvpt-pipe';
export class AwsTravelportPipeConsumerStack extends Stack {
  // eslint-disable-next-line class-methods-use-this
  get availabilityZones(): string[] {
    return ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'];
  }

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Tag everything
    Tags.of(this).add('app', appPrefix);

    // Create a new VPC because any existing can have a certain constrains
    // https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html
    // VPC will be created in accordance with all best practices implemented in CDK
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ec2-readme.html
    const newVpc = new ec2.Vpc(
      this,
      `${appPrefix}-vpc`,
      {
        gatewayEndpoints: {
          S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
          },
        },
      },
    );

    // Creating S3 bucket to store incoming data.
    // Just for the sake of demonstration of data processing.
    const bucket = new s3.Bucket(this, `${appPrefix}-bucket`, {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Creating ECS cluster which will host processing application
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
    const cluster = new ecs.Cluster(this, `${appPrefix}-cluster`, {
      vpc: newVpc,
      enableFargateCapacityProviders: true,
    });

    // The role assumed by Fargate task and its containers
    const taskRole = new iam.Role(this, `${appPrefix}-task-role`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: `${appPrefix}-task-role`,
      description: 'Role that the api task definitions use to run the fargate code',
    });

    // Attaching IAM policy which will allow to work with newly created bucket
    taskRole.attachInlinePolicy(
      new iam.Policy(this, `${appPrefix}-task-policy`, {
        statements: [
          // policies to allow access to other AWS services from within the container e.g S3
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['S3:*'],
            resources: [bucket.arnForObjects('*')],
          }),
        ],
      }),
    );

    // Creating Network ELB, ECS Service, ECS Task Definition,
    // Uploading application Docker image and few related stuff
    // For the sake of simplicity, CDK patten is used
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs-patterns.NetworkLoadBalancedFargateService.html
    const loadBalancedFargateService = new ecsPatterns.NetworkLoadBalancedFargateService(this, `${appPrefix}-service`, {
      cluster,
      cpu: 1024,
      memoryLimitMiB: 2048,
      desiredCount: 2,
      listenerPort: ELB_PORT,
      publicLoadBalancer: false,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
      maxHealthyPercent: 200,
      minHealthyPercent: 100,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../src/docker'),
        containerPort: CONTAINER_PORT,
        taskRole,
        environment: {
          S3_WORK_BUCKET: bucket.bucketName,
        },
      },
    });

    // Allow any traffic within VPC to container's PORT
    loadBalancedFargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(newVpc.vpcCidrBlock),
      ec2.Port.tcp(CONTAINER_PORT),
      `Allow any traffic from VPC to Fargate service to ${CONTAINER_PORT} port`,
    );

    // Setup automatic scaling IN & OUT of number of tasks 
    // based on CPU and/or memory consumption
    const scalableTarget = loadBalancedFargateService.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 25,
    });

    scalableTarget.scaleOnMemoryUtilization(`${appPrefix}-ScaleUpMem`, {
      targetUtilizationPercent: 75,
    });

    scalableTarget.scaleOnCpuUtilization(`${appPrefix}-ScaleUpCPU`, {
      targetUtilizationPercent: 75,
    });

    // Attaching AWS Endpoint Service to Network ELB
    // It will allow to send data without living AWS network
    // https://docs.aws.amazon.com/vpc/latest/privatelink/endpoint-service-overview.html
    const endpointServiceForTVPT = new ec2.VpcEndpointService(this, `${appPrefix}-EndpointService`, {
      vpcEndpointServiceLoadBalancers: [loadBalancedFargateService.loadBalancer],
      acceptanceRequired: false,
      allowedPrincipals: [new iam.ArnPrincipal(`arn:aws:iam::${ENDPOINT_ALLOWED_PRINCIPAL}:root`)],
    });

    // eslint-disable-next-line no-new
    new CfnOutput(this, `${appPrefix}-VPC-ENDPOINT-NAME`, {
      exportName: `${appPrefix}-VPC-ENDPOINT-NAME`,
      value: endpointServiceForTVPT.vpcEndpointServiceName,
    });

    // eslint-disable-next-line no-new
    new CfnOutput(this, `${appPrefix}-S3-WORK-BUCKET`, {
      exportName: `${appPrefix}-S3-WORK-BUCKET`,
      value: bucket.bucketName,
    });
  }
}
