import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
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
      generateSecret: false, // SPA / Web uygulamalarında secret tutulamaz (Public Client)
      authFlows: {
        userPassword: true,
      },
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'SnapShare web sitesinin global CDN adresi',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });
  }
}
