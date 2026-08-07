# Aluna — Product idea and concept

## The idea in one sentence

Aluna turns one honest product photograph into a complete set of campaign-ready marketing images
that feel made for the customer's brand, while keeping the real product recognizable and accurate.

This document explains the product as a business and customer experience. It intentionally avoids
software architecture and implementation details.

## The problem

Small brands, online sellers, agencies, and growing product businesses need a constant supply of
good visual content. Traditional photography is powerful, but every new campaign usually requires a
photographer, models, a location, props, lighting, editing, coordination, and another budget. The
result is slow and expensive, especially when a business needs images for many products, channels,
seasons, and markets.

Generic image-generation tools solve only part of this problem. They can create attractive images,
but they often:

- alter the real shape, color, material, label, logo, or printed text of the product;
- put the product in an environment that makes no commercial sense;
- repeat similar models, poses, backgrounds, or compositions for different customers;
- forget the customer's brand identity between campaigns;
- force the customer to become an expert prompt writer;
- provide little explanation of cost, quality, or why a result failed.

For a product business, a beautiful image is not enough. The image must still sell the correct
product and feel unmistakably connected to the correct brand.

## The Aluna promise

Aluna is an intelligent product-photo studio, not a blank prompt box. The customer supplies the
truth—the real product and the real brand—and Aluna builds a campaign around that truth.

The promise has four parts:

1. **Product fidelity:** preserve the product's visible identity: shape, proportions, colors,
   materials, logos, labels, and printed information.
2. **Commercial intelligence:** understand what the product is and avoid irrelevant settings. A
   creatine supplement should not be treated as ordinary kitchen food; a perfume bottle should not
   be staged like electronics.
3. **Brand memory:** remember the business type, audience, tone, palette, slogan, preferred visual
   world, and prohibited ideas for future campaigns.
4. **Useful variety:** make every result meaningfully different without losing campaign coherence or
   giving unrelated customers the same recognizable model and setup.

## Who Aluna is for

### Independent product businesses

Founders and small teams that need professional images but cannot organize a physical shoot for
every launch, product variation, promotion, or social post.

### E-commerce teams

Stores that already have clean product photos and need catalogue heroes, lifestyle scenes, on-model
fashion images, paid-ad creatives, and seasonal variations at scale.

### Marketing teams and agencies

People who need to explore multiple creative directions quickly, present options, and maintain a
consistent client brand across many campaigns.

### Marketplaces and resellers

Businesses that receive inconsistent supplier images and need a cleaner, more coherent visual system
without changing the item being sold.

## The customer experience

### 1. Establish the brand

The customer creates one Brand Profile for the account. It can include:

- brand name, business type, positioning, markets, and languages;
- audience and preferred model direction;
- official logo and slogan;
- primary, secondary, and accent colors;
- typography names;
- tone, values, photography style, and campaign objectives;
- environments and visual elements the brand prefers;
- environments, claims, and visual elements the brand forbids.

The Brand Profile is not decoration. It is the brand's creative constitution. It should guide every
campaign and keep doing so until the customer changes it. Each saved version remains connected to the
campaigns that used it, making old results understandable even after the profile evolves.

### 2. Upload the real product

The customer uploads a clear source photograph. It does not need to be a finished campaign image. A
phone photograph, simple catalogue image, flat garment, bottle, package, furniture item, or device
can become the starting point.

### 3. Let Aluna understand the product

The Product Analyst studies the photograph and identifies the visible product, material, colors,
surface finish, physical form, visible writing, handling constraints, and commercially appropriate
contexts. It proposes several scene ideas specifically for that product.

The goal is not merely to label the object. The goal is to understand what kind of photography the
object earns. Reflective packaging needs different light from fabric; a supplement needs a different
world from a dessert; a cosmetic dropper needs a different scale and camera distance from furniture.

### 4. Direct the campaign

The customer can accept an intelligent recommendation or control the direction manually. Depending
on the category, choices can include:

- scene and environment;
- mood, composition, camera language, light, and color world;
- on-model, ghost-mannequin, or flat-lay fashion presentation;
- adult model gender presentation, age range, appearance, body build, hair, expression, pose, and
  framing;
- number of outputs and a short campaign brief.

### 5. Review the Intelligent Creative Director plan

Before spending generation credits, Aluna explains the campaign logic. The customer sees:

- what the product was classified as and the confidence level;
- which Brand Profile rules are active;
- whether an unsuitable scene was corrected;
- the campaign objective, environment, mood, camera, lighting, and composition;
- the role of each requested image, such as hero, lifestyle, detail, or editorial.

This is the point where Aluna becomes more than a generator. It acts like a creative director who can
explain the plan before sending work to the production team.

### 6. Generate and manage the campaign

The customer generates one or many images. Progress is visible, completed variants appear as they
finish, and the campaign remains available in the Studio's campaign history and asset library.

## Product categories

Aluna starts with broad commercial categories that need different visual rules:

- Clothing
- Cosmetics and makeup
- Food
- Health and wellness
- Jewelry
- Furniture
- Electronics

Each category contains curated scene directions, but intelligent product-specific scenes can go
beyond the fixed presets when the source photograph provides enough information.

## The three product surfaces

### The landing experience

The public website introduces the promise through real before-and-after examples, fashion and
cosmetics use cases, the process, product-fidelity principles, frequently asked questions, and a
waiting list. It should make the value clear before asking the visitor to understand the technology.

### Aluna Studio

The Studio is the customer's private workspace. One account represents one person, not a company
with owner and agent sub-roles. That person controls the Brand Profile, uploads products, directs
campaigns, generates variants, and accesses their own results.

### The Super Admin control center

There is one Super Admin. The Super Admin operates Aluna as a service and can:

- create, edit, suspend, time-ban, reactivate, or delete customer accounts;
- set hourly, daily, concurrent, and per-request generation limits;
- review every generation operation, source, output, error, duration, and estimated cost;
- understand consumption by customer, provider, category, and period;
- monitor application, queue, storage, and provider health;
- manage the waiting list;
- select the active image provider and model;
- configure server-side provider credentials without exposing them to customers.

The Super Admin is a service operator, not another kind of Studio customer.

## What makes Aluna different

### It begins with identity, not imagination

The source product is the highest authority. Brand rules and creative ideas come after it. A result
that looks impressive but changes the real product is not a successful result.

### It separates understanding from image production

Aluna first understands the product, then builds the commercial plan, then asks an image model to
execute that plan. This prevents the image model from making every business decision by itself.

### It remembers the brand

Customers should not have to repeat the same slogan, palette, audience, and restrictions in every
prompt. Brand knowledge belongs to the account and becomes part of every future campaign.

### It explains its decisions

The Creative Director makes context corrections and shot planning visible. Customers can understand
why Aluna chose a wellness studio instead of a kitchen or why a campaign uses a particular lighting
approach.

### It protects variety

A campaign should look related internally, but customers should not receive cloned identities and
setups. Aluna plans different shot roles, camera positions, compositions, and fictional adult model
identities while keeping the brand and product consistent.

## Trust principles

- Never deliberately invent or alter product claims, certification marks, dosage, labels, logos, or
  legal text.
- Never imply that a generated person is a real customer, celebrity, or public figure.
- Keep customer products, Brand Profiles, logos, and results private between accounts.
- Clearly distinguish generated marketing imagery from documentary proof when the context requires
  it.
- Keep cost and usage visible to the operator.
- Reject or regenerate unsafe, misleading, incoherent, or low-fidelity outputs when automated
  evaluation becomes available.

## What Aluna is not

- It is not a general-purpose art generator.
- It is not a logo or packaging-design tool.
- It is not a place to reproduce celebrities or real people without rights and consent.
- It is not a guarantee that every model output is legally or commercially ready without review.
- It does not replace the highest-end physical shoot when exact documentary accuracy, complex human
  interaction, or regulated evidence is required.

## Business model possibilities

The product can support several commercial models without changing its central promise:

- monthly subscription with an included image allowance;
- pay-as-you-go generation credits;
- higher-quality provider/model upgrades;
- agency plans with larger volumes and export features;
- private brand onboarding and art-direction services;
- premium model-rights and private casting libraries in a later phase.

The safest early model is a controlled pilot: invite customers manually, set individual limits, and
measure the real cost and approval rate before publishing broad self-service pricing.

## Success measures

Aluna should be judged by outcomes, not only by the number of images created:

- percentage of outputs the customer keeps;
- product-fidelity approval rate;
- percentage of campaigns approved without regeneration;
- time from upload to usable campaign;
- cost per accepted image;
- repeat campaigns per customer;
- Brand Profile completion and reuse;
- diversity between customers and between campaign variants;
- waiting-list conversion and active-customer retention;
- provider failure, moderation, and timeout rates.

## Product roadmap

### Foundation

Brand Profile, product analysis, Creative Director planning, multi-provider generation, Studio asset
history, and Super Admin operations.

### Quality control

Automatic checks for OCR/text, logos, silhouette, color, proportions, anatomy, scene relevance, and
cross-campaign similarity before a result reaches the customer.

### Inspiration Gallery

A curated gallery of licensed or Aluna-owned directions. Customers can use a complete direction or
borrow only selected qualities such as lighting, composition, mood, or environment. Brand and product
rules always remain above inspiration.

### Casting Library

Shared synthetic or licensed models, private client-owned models with consent and usage rights, and
unique identities reserved for a campaign or customer.

### Campaign production system

Channel-specific crops, ad variations, deterministic logo and slogan placement, team review,
approval, export bundles, and integrations with commerce and advertising platforms.

## The long-term vision

Aluna can become the visual operating system for a product brand: a place where product truth, brand
memory, creative direction, production, quality control, assets, cost, and learning live together.
The long-term advantage is not simply access to an image model. It is the accumulated understanding
of how each customer's real products should look, where they belong, and what their brand should
never become.
