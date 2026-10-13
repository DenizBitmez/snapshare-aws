# ADR 0001: Serverless Architecture

## Status
Accepted

## Context
The platform needs to handle unpredictable, spiky traffic (photo uploads) at minimal cost,
with no servers to patch or manage.

## Decision
Use a fully serverless stack: Lambda, API Gateway, DynamoDB, S3, SNS/SQS.

## Alternatives Considered
- **EC2 + ALB + RDS:** Always-on cost (ALB, RDS, NAT Gateway), manual scaling and patching.
- **ECS Fargate:** Less ops than EC2 but still pays for idle tasks.

## Consequences
- ✅ Pay-per-use, scales to zero, fits Free Tier
- ✅ Built-in high availability across AZs
- ⚠️ Lambda limits (15 min timeout, cold starts)
- ⚠️ DynamoDB requires access-pattern-first data modeling
