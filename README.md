# 📸 SnapShare — Serverless Photo Sharing on AWS

A fully serverless, event-driven photo sharing platform built with **AWS CDK (TypeScript)**,
designed as a hands-on study project for the **AWS Solutions Architect – Associate (SAA-C03)** exam.

## Architecture

```
User → CloudFront → S3 (frontend)
          ↓
     API Gateway ← Cognito (auth)
          ↓
       Lambda → DynamoDB
          ↓
S3 (uploads) → SNS → SQS → Lambda (thumbnail)
                   → SQS → Lambda (Rekognition labels)
                   → Email notification
                   (failures → DLQ)
```

## Roadmap

| # | Phase | Services | SAA Concepts | Status |
|---|-------|----------|--------------|--------|
| 0 | Setup | IAM Identity Center, Budgets, CLI, CDK | Least privilege, cost control | ⏳ |
| 1 | Frontend | S3, CloudFront, OAC | CDN, caching, secure S3 | ⬜ |
| 2 | Auth | Cognito | User Pools vs Identity Pools | ⬜ |
| 3 | API & Data | API Gateway, Lambda, DynamoDB | Serverless, NoSQL design | ⬜ |
| 4 | Event Pipeline | S3 Events, SNS, SQS, DLQ, Rekognition | Decoupling, fan-out | ⬜ |
| 5 | Security & Observability | IAM, CloudWatch, X-Ray | Encryption, monitoring | ⬜ |
| 6 | IaC & CI/CD | CDK, GitHub Actions | Automation | ⬜ |
| ★ | Bonus: DR | S3 Cross-Region Replication | RTO / RPO | ⬜ |

## Project Structure

```
infra/      AWS CDK app (TypeScript)
frontend/   Static web app (HTML/CSS/JS)
lambdas/    Lambda function source code
docs/       Architecture diagrams & decision records (ADRs)
```

## Cost

Designed to stay within AWS Free Tier / credits (~$0–1/month). Tear down with `cdk destroy`.