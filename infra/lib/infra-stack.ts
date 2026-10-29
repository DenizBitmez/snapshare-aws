import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwAuthorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const websiteBucket = new s3.Bucket(this, 'SnapShareFrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SnapShareDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const userPool = new cognito.UserPool(this, 'SnapShareUserPool', {
      userPoolName: 'snapshare-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('SnapShareWebClient', {
      userPoolClientName: 'snapshare-web-client',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true, // SRP akışı etkinleştirildi!
      },
    });

    const uploadsBucket = new s3.Bucket(this, 'SnapShareUploadsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          maxAge: 300,
        },
      ],
    });

    const photosTable = new dynamodb.Table(this, 'SnapSharePhotosTable', {
      tableName: 'SnapShare-Photos',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'photoId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const rootDir = path.join(__dirname, '../../');
    const presignFunction = new lambdaNodejs.NodejsFunction(this, 'PresignUrlHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(rootDir, 'lambdas/presign/index.ts'),
      projectRoot: rootDir,
      depsLockFilePath: path.join(rootDir, 'infra/package-lock.json'),
      handler: 'handler',
      environment: {
        UPLOADS_BUCKET_NAME: uploadsBucket.bucketName,
        TABLE_NAME: photosTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: false,
      },
    });

    uploadsBucket.grantPut(presignFunction);
    photosTable.grantWriteData(presignFunction);

    const httpApi = new apigwv2.HttpApi(this, 'SnapShareHttpApi', {
      apiName: 'snapshare-http-api',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    const authorizer = new apigwAuthorizers.HttpUserPoolAuthorizer(
      'SnapShareCognitoAuthorizer',
      userPool,
      {
        userPoolClients: [userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    const presignIntegration = new apigwIntegrations.HttpLambdaIntegration(
      'PresignIntegration',
      presignFunction
    );

    httpApi.addRoutes({
      path: '/photos/upload-url',
      methods: [apigwv2.HttpMethod.POST],
      integration: presignIntegration,
      authorizer: authorizer,
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'SnapShare Web Sitesi (CDN)',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.url!,
      description: 'API Gateway HTTP API URL',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 Raw Uploads Bucket Name',
    });
  }
}
