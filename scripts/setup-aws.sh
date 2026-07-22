#!/usr/bin/env bash
#
# Crea el usuario IAM que la app en Vercel usa para llegar a DynamoDB, acotado
# EXCLUSIVAMENTE a la tabla de este stack, e imprime las credenciales para
# pegarlas como variables de entorno en Vercel.
#
# Ejecútalo con un perfil admin, DESPUÉS de que exista la tabla (lee el ARN
# del stack). El pipeline de GitHub usa otro usuario distinto: ver
# scripts/setup-github-secrets.sh.
#
#   ./scripts/setup-aws.sh --profile miperfil
#
# Es idempotente: usuario y política se reconcilian, no se duplican. Solo se
# crea una access key nueva con --new-key (AWS permite 2 por usuario).
#
set -euo pipefail

PROFILE=""
REGION="eu-west-1"
STACK_NAME="template-app"
USER_NAME="template-app-vercel"
POLICY_NAME="template-app-dynamodb"
NEW_KEY=false

usage() {
  cat <<EOF
Uso: $0 --profile <perfil-aws> [opciones]

Opciones:
  --profile <name>   Perfil de AWS CLI (obligatorio)
  --region <name>    Región AWS (por defecto: $REGION)
  --stack <name>     Nombre del stack CloudFormation (por defecto: $STACK_NAME)
  --new-key          Crear una access key nueva aunque ya exista una
  -h, --help         Esta ayuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --region)  REGION="${2:-}"; shift 2 ;;
    --stack)   STACK_NAME="${2:-}"; shift 2 ;;
    --new-key) NEW_KEY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$PROFILE" ]]; then
  echo "error: --profile es obligatorio" >&2
  usage
  exit 1
fi

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "==> Comprobando credenciales del perfil '$PROFILE'…"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "    Cuenta: $ACCOUNT_ID  Región: $REGION"

echo "==> Leyendo ARN de la tabla desde el stack '$STACK_NAME'…"
TABLE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='TableArn'].OutputValue" --output text)
TABLE_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" --output text)
if [[ -z "$TABLE_ARN" || "$TABLE_ARN" == "None" ]]; then
  echo "error: el stack no expone TableArn. ¿Has desplegado infra/dynamodb.yml?" >&2
  exit 1
fi
echo "    Tabla: $TABLE_NAME ($TABLE_ARN)"

echo "==> Reconciliando usuario IAM '$USER_NAME'…"
if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
  aws iam create-user --user-name "$USER_NAME" >/dev/null
  echo "    Usuario creado."
else
  echo "    Usuario ya existe."
fi

echo "==> Aplicando política acotada a la tabla…"
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
  echo "==> Ya existe una access key ($EXISTING_KEYS). Usa --new-key para crear otra."
  echo
  echo "Variables para Vercel (la secret key solo se muestra al crearla):"
  echo "  AWS_REGION=$REGION"
  echo "  DYNAMODB_TABLE=$TABLE_NAME"
  echo "  AWS_ACCESS_KEY_ID=$EXISTING_KEYS"
  exit 0
fi

echo "==> Creando access key…"
CREDS=$(aws iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
KEY_ID=$(echo "$CREDS" | cut -f1)
SECRET=$(echo "$CREDS" | cut -f2)

echo
echo "================================================================"
echo "Pega estas variables de entorno en Vercel (Settings → Env Vars):"
echo "================================================================"
echo "  AWS_REGION=$REGION"
echo "  DYNAMODB_TABLE=$TABLE_NAME"
echo "  AWS_ACCESS_KEY_ID=$KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY=$SECRET"
echo
echo "La secret key NO se puede recuperar después: guárdala ahora."
