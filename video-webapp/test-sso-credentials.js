#!/usr/bin/env node
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { fromSSO } from "@aws-sdk/credential-providers";

const client = new SSMClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: fromSSO({ profile: process.env.AWS_PROFILE || "n11817143-a2" })
});

const run = async () => {
  try {
    console.log('🔄 Testing AWS SSO credentials...');
    console.log(`Using profile: ${process.env.AWS_PROFILE || "n11817143-a2"}`);
    console.log(`Using region: ${process.env.AWS_REGION || "ap-southeast-2"}`);
    
    const resp = await client.send(
      new GetParameterCommand({ Name: "/n11817143/app/s3Bucket" })
    );
    
    console.log('\n✅ Successfully retrieved parameter:');
    console.log(resp.Parameter);
    
    console.log('\n🎉 AWS SSO credentials are working correctly!');
  } catch (error) {
    console.error('\n❌ Error retrieving parameter:');
    console.error(error.message);
    
    if (error.name === 'UnauthorizedOperation' || error.name === 'AccessDenied') {
      console.log('\n💡 This might be due to:');
      console.log('1. AWS SSO session expired - run: aws sso login --profile n11817143-a2');
      console.log('2. Insufficient permissions for SSM parameter access');
      console.log('3. Parameter doesn\'t exist or wrong parameter name');
    } else if (error.message.includes('No SSO provider')) {
      console.log('\n💡 Make sure AWS SSO is configured:');
      console.log('1. Run: aws configure sso --profile n11817143-a2');
      console.log('2. Or run: aws sso login --profile n11817143-a2');
    }
  }
};

run().catch(console.error);