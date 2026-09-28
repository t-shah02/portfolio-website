---
kicker: Anime image board
title: Dexbooru
order: 1
---

A taggable image board for anime, manga, and Japanese pop culture, built as several services. The web app, notification service, and AWS infrastructure are below. A separate Python service handles similarity search.

## see more

![Dexbooru home page with search and live stats](/assets/images/projects/dexbooru/screens/home.webp)
![Posts browse with filters, tag sidebar, and thumbnail grid](/assets/images/projects/dexbooru/screens/posts.webp)
![Post detail page with image, tags, metadata, and comments](/assets/images/projects/dexbooru/screens/post-detail.webp)

**Live site:** [dexbooru.neetbyte.fun](https://dexbooru.neetbyte.fun)

Dexbooru is the public face of the project: a Danbooru-style board where uploads are tagged, searchable, and browsed in a responsive grid. The home page centers on tag search with a syntax guide, and it surfaces live counts for posts, tags, artists, collections, and users.

## What you can do there

- Browse posts with sort orders for recency, likes, views, and comments, plus tag and artist filters in the sidebar.
- Explore the tag index and jump into filtered post lists from any tag or artist link.
- Open a post to see the full image, tag and artist links, source metadata, similar-image search, and comments.

## Under the hood

The SvelteKit app talks to PostgreSQL through Prisma, caches hot paths in Redis, and serves media from S3 behind CloudFront. Uploads enqueue work for tagging and similarity search; friend invites and comments flow through the notifications service over WebSockets.

### Web application

url: https://github.com/Dexbooru/dexbooru-web
stack: TypeScript, SvelteKit, Prisma, PostgreSQL, Redis, S3, CloudFront

The main web app. Users upload and tag images, comment on posts, add friends, and save posts to collections.

### Notifications Microservice

url: https://github.com/Dexbooru/dexbooru-notifications
stack: TypeScript, Bun, RabbitMQ, MongoDB

A Bun service that reads events from RabbitMQ, saves friend invites and comments to MongoDB, and pushes them to browsers over WebSockets.

### AWS infrastructure configuration

url: https://github.com/Dexbooru/dexbooru-infrastructure
stack: Terraform, AWS, S3, CloudFront, SQS, Lambda

Terraform for the S3 media buckets, the CloudFront CDN, an SQS queue, and a Lambda that tags each post image with its anime series. GitHub Actions applies changes on every push to main.
