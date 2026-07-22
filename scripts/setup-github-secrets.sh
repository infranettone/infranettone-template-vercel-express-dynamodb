#!/usr/bin/env bash
#
# Creates the IAM user that the GitHub Actions pipeline uses to deploy the
# CloudFormation stack (deploy-infra.yml) and uploads its credentials as repo
# secrets with `gh`. Separate from the Vercel runtime user: the pipeline user
# can touch CloudFormation + DynamoDB (create the table); the Vercel one only
# reads/writes the table's data.
#
#   ./scripts/setup-github-secrets.sh --profile myprofile --repo user/repo
#
set -euo pipefail

PROFILE=""
REGION="eu-west-1"
REPO=""
USER_NAME="vedtemplate-app-deploy"
POLICY_NAME="vedtemplate-app-deploy"
STACK_NAME="vedtemplate-app"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region)  REGION="${2:-}"; shift 2 ;;
    --repo)    REPO="${2:-}"; shift 2 ;;
    --stack)   STACK_NAME="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --profile <profile> --repo <owner/repo> [--region r] [--stack s]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$PROFILE" || -z "$REPO" ]] && { echo "error: --profile and --repo are required" >&2; exit 1; }

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "==> Account $ACCOUNT_ID, region $REGION, repo $REPO"

if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
  aws iam create-user --user-name "$USER_NAME" >/dev/null
  echo "==> IAM user '$USER_NAME' created."
fi

POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudformation:*"],
      "Resource": "arn:aws:cloudformation:$REGION:$ACCOUNT_ID:stack/$STACK_NAME/*"
    },
    { "Effect": "Allow", "Action": ["cloudformation:ValidateTemplate"], "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:CreateTable", "dynamodb:UpdateTable", "dynamodb:DescribeTable",
                 "dynamodb:UpdateTimeToLive", "dynamodb:DescribeTimeToLive",
                 "dynamodb:UpdateContinuousBackups", "dynamodb:DescribeContinuousBackups",
                 "dynamodb:TagResource", "dynamodb:ListTagsOfResource"],
      "Resource": "arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/$STACK_NAME*"
    }
  ]
}
JSON
)
aws iam put-user-policy --user-name "$USER_NAME" \
  --policy-name "$POLICY_NAME" --policy-document "$POLICY_DOC"

echo "==> Creating access key and uploading it as GitHub secrets…"
CREDS=$(aws iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
KEY_ID=$(echo "$CREDS" | cut -f1)
SECRET=$(echo "$CREDS" | cut -f2)

gh secret set AWS_ACCESS_KEY_ID --repo "$REPO" --body "$KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO" --body "$SECRET"

echo "==> Done. The deploy-infra.yml workflow can now deploy the stack."
