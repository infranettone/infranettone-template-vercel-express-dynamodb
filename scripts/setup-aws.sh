#!/usr/bin/env bash
#
# Creates the IAM user that the Vercel app uses to reach DynamoDB, scoped
# EXCLUSIVELY to this stack's table, and prints the credentials to paste as
# environment variables in Vercel.
#
# Run it with an admin profile, AFTER the table exists (it reads the ARN from
# the stack). The GitHub pipeline uses a different user: see
# scripts/setup-github-secrets.sh.
#
#   ./scripts/setup-aws.sh --profile myprofile
#
# Idempotent: the user and policy are reconciled, not duplicated. A new access
# key is only created with --new-key (AWS allows 2 per user).
#
set -euo pipefail

PROFILE=""
REGION="eu-west-1"
STACK_NAME="vedtemplate-app"
USER_NAME="vedtemplate-app-vercel"
POLICY_NAME="vedtemplate-app-dynamodb"
NEW_KEY=false

usage() {
  cat <<EOF
Usage: $0 --profile <aws-profile> [options]

Options:
  --profile <name>   AWS CLI profile (required)
  --region <name>    AWS region (default: $REGION)
  --stack <name>     CloudFormation stack name (default: $STACK_NAME)
  --new-key          Create a new access key even if one already exists
  -h, --help         This help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region)  REGION="${2:-}"; shift 2 ;;
    --stack)   STACK_NAME="${2:-}"; shift 2 ;;
    --new-key) NEW_KEY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$PROFILE" ]]; then
  echo "error: --profile is required" >&2
  usage
  exit 1
fi

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "==> Checking credentials for profile '$PROFILE'…"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "    Account: $ACCOUNT_ID  Region: $REGION"

echo "==> Reading the table ARN from stack '$STACK_NAME'…"
TABLE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='TableArn'].OutputValue" --output text)
TABLE_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" --output text)
if [[ -z "$TABLE_ARN" || "$TABLE_ARN" == "None" ]]; then
  echo "error: the stack does not expose TableArn. Have you deployed infra/dynamodb.yml?" >&2
  exit 1
fi
echo "    Table: $TABLE_NAME ($TABLE_ARN)"

echo "==> Reconciling IAM user '$USER_NAME'…"
if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
  aws iam create-user --user-name "$USER_NAME" >/dev/null
  echo "    User created."
else
  echo "    User already exists."
fi

echo "==> Applying policy scoped to the table…"
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem",
        "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:DescribeTable"
      ],
      "Resource": ["$TABLE_ARN", "$TABLE_ARN/index/*"]
    }
  ]
}
JSON
)
aws iam put-user-policy --user-name "$USER_NAME" \
  --policy-name "$POLICY_NAME" --policy-document "$POLICY_DOC"

EXISTING_KEYS=$(aws iam list-access-keys --user-name "$USER_NAME" \
  --query 'AccessKeyMetadata[].AccessKeyId' --output text)

if [[ -n "$EXISTING_KEYS" && "$NEW_KEY" != true ]]; then
  echo "==> An access key already exists ($EXISTING_KEYS). Use --new-key to create another."
  echo
  echo "Variables for Vercel (the secret key is only shown when created):"
  echo "  AWS_REGION=$REGION"
  echo "  DYNAMODB_TABLE=$TABLE_NAME"
  echo "  AWS_ACCESS_KEY_ID=$EXISTING_KEYS"
  exit 0
fi

echo "==> Creating access key…"
CREDS=$(aws iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
KEY_ID=$(echo "$CREDS" | cut -f1)
SECRET=$(echo "$CREDS" | cut -f2)

echo
echo "================================================================"
echo "Paste these environment variables into Vercel (Settings → Env Vars):"
echo "================================================================"
echo "  AWS_REGION=$REGION"
echo "  DYNAMODB_TABLE=$TABLE_NAME"
echo "  AWS_ACCESS_KEY_ID=$KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY=$SECRET"
echo
echo "The secret key CANNOT be recovered later: save it now."
