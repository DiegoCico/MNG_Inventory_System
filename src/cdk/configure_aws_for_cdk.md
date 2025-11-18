### Access keys (IAM user)

```bash
aws configure --profile mng-dev
# Paste Access Key ID / Secret from IAM
# Default region: us-east-1
# Output: json

export AWS_PROFILE=mng-dev
export AWS_REGION=us-east-1
aws sts get-caller-identity
```

# CDK

npm i
npm run cdk:bootstrap
npm run cdk:synth
npm run cdk:diff
npm run cdk:deploy
npm run cdk:destroy
