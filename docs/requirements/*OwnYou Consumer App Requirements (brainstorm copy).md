Complimentary documentation:
[[* OwnYou Project-brief]]
[[*OwnYou's Vision and User Experiences]]
[[* OwnYou Advertising MVP vision, core journey and technical specification]]
[[BBS+ Pseudonyms]] - the original BBS+ Pseudonym specification
[[* BBS+ Pseudonymous ID specification v1]] - a first take on how that might looks within the overall OwnYou framework.
[[* BBS+ Pseudonym Recommendations]] - on how the first take might be improved.
NOTE: the BBS+ Pseudonym architecture is a work in progress and needs to be completed in context of both the consumer application requirements and the Advertising requirements, which include the OwnYou SSO speficition.

## 1. Project Overview

### Applications Name

OwnYou Consumer App

### Github Repo

*Move from personal to OwnYou.*

### App Description

[[*OwnYou's Vision and User Experiences]] is a must-read document, for additional context on the overall project. The following description is a summary only.

*OwnYou makes it possible for consumers to leverage their personal data for rich AI experiences, without having to share that unencrypted personal data with any third party.* Personal AI, including personal financial advice, personal shopping assistance, bill management, and medical advice, benefits from rich and relevant personal data. The more you share with your private AI, the better the experience. Financial records, medical records, social media and email communication - the more intimate the data, the more personal and useful the experience. OwnYou makes it possible for individuals to leverage their personal information without having to share it a third party — and without worrying that some new form of intelligence might use it against them. Unlike third-party AI, individuals are incentivised to share more about themselves. The more they share, the richer the experience — without the risks typically associated with sharing personal data with third-party providers.

OwnYou makes it easy for users to curate their own personal data archive.
Personal AI services leverage that archive without sharing any information with a third party using open source models.
OwnYou uses AI to build a provably authentic customer profile for advertisers - controlled by the user, monetised for the user.

### Ikigai

At the core of the OwnYou consumer experience, in additional to a first principals approach to privacy first self-sovereign technology, is the helping users to explore, nurture and pursue their Ikigai.

Ikigai is a Japanese term that translates to "the value of life" or "happiness in life". It is composed of two words: _iki_, meaning life, and _gai_, meaning value or worth. Essentially, it's the reason you get up in the morning. The word _gai_ originates from _kai_, meaning "shell," as shells were once considered valuable. The concept of ikigai can be traced back to the Heian period (794-1185 CE).

Unlike some Western interpretations that equate ikigai with a grand life purpose, ikigai is more aligned with finding joy in the day-to-day aspects of life, or _seikatsu_, rather than one's entire lifetime, or _jinsei_. It is a multifaceted and personal concept that is understood through life experience rather than formal education.

Unlikely other forms of media, or consumer application, OwnYou chooses not to leverage fear, anxiety, or other negative feelings, for traction. OwnYou chooses to leverage the concept of ikigai to provide measurable value through missions with tangible financial benefit.

More on the nature of Ikigai can be found in the [[OwnYou requirements/Agents/OwnYou Rope Agent/Ikigai|Ikigai]] document.

### Target Audience

The primary user of the OwnYou Consumer App is the **Consumer**, an individual seeking tangible, real-world benefits from personal AI without having to sacrifice their privacy, and without having to be beholden to any particular LLM provider. The user experience is centred around the user specific needs include how they save and spend money, and how their pursue their particular *Ikigai*. A focus on *Missions*, delivers tangible utility from harvesting their own personal data, for their one utility.

The OwnYou Consumer application includes a digital wallet that creates and manages OwnYou IDs for the OwnYou SSO, and helps them manage their advertising experience.

OwnYou SSO and advertiser requirements are details in [[* OwnYou Advertising MVP vision, core journey and technical specification]].

### Design Principles

- **Utility First, Privacy Always**: The primary user motivation is tangible value. The design will showcase this value, while the underlying architecture ensures privacy is never compromised.
- **Quietly Intelligent, Never Intrusive**: The AI should be proactive but respectful. Insights are surfaced as gentle suggestions, not demanding notifications.
- **Playful & Empowering**: The UI/UX, from the branding to the micro-interactions, should feel fun and give the user a sense of agency and control over their digital life.
- **Build Trust Through Transparency**: Be clear about how and why the AI is making suggestions to build a strong, trusting relationship with the user.
- **Compelling & "Sticky"**: The app must be compelling enough for users to engage with it multiple times a day. It will be populated with new content on a constant basis. The user must be able to prompt the app to search for additional information around any initial recommendation, tasking the app to follow up on the user's behalf and continuously learn more about them.

### Core Consumer Value Proposition

- Hyper-personalized AI agent services driven by personal data without having to share that personal data with third parties (note the MVP may leverage third party inference, as part of the proof of concept).
- personalised shopping assistant, travel booking assistance, medical and health advice and bill optimization.
- an app that, by leveraging emails and financial records, knows what the consumer wants, understand's their "Ikigai", and delivers personalised content and services, without the user having to sacrifice their privacy or agency.
- Instead of the user becoming "the product", they become the centre of any monetisation flow by exchanging their personal profile in exchange for value.
- Instead of the user having to proactively search for information, goods or services, OwnYou's personal AI Agents seek and present information to the user, based on their personal data, without the user having to share that personal data with a third party.

### Technology Principles

Any proposed solution must be evaluated against a set of core principles that align with the ethos of the decentralized web. The goal is not simply to find a functional workaround but to design a system that is fundamentally more secure, equitable, and user-centric than the status quo.

- **Security:** The system must provide robust protection for all sensitive credentials, including the dApp's API keys and any user access_tokens. It must prevent unauthorized access, tampering, and leakage at all stages of the data access lifecycle.
- **User Sovereignty:** The end-user must be the ultimate arbiter of their own data. They must have explicit control over what data is shared, with which applications, and for how long. The architecture must empower the user to grant, manage, and revoke access permissions directly, without relying on the dApp developer as a gatekeeper. Any access_token which, for instance, may represent the key to the user's financial data, should be treated as a user-owned asset, not a developer-managed resource.
- **Trust-Minimization:** The system must reduce, to the greatest extent technically feasible, the need for users to trust any single party, including the dApp developer, network node operators, or hardware manufacturers. Trust should be shifted from opaque, centralized entities to transparent, verifiable code and decentralized, crypto-economically secured systems. [Less trust, more truth](https://doi.org/10.1016/j.techfore.2024.123810).

These three objectives—security, user sovereignty, and trust-minimization—form the evaluative framework for the architectural models proposed in the subsequent sections of this report.

---

## 2. Technical Specifications

> [!warning] Extremely Important Note
> Exploring the balance between on device and off-device compute and managing decentralized storage and decentralized private computing resources is critically important. There will always be a temptation to roll-back to web2.0 managed cloud resources but that is a fundamental break of OwnYou's mission statement; self-sovereign private AI, monetised through P2P advertising. Any proof-of-concept may purposefully break that promise but the breaks must be explained, and the route to a secure decentralized solution be sufficiently charted.

### Platform & Technology Stack

To be determined.

### Data Pipeline

- The application captures raw user data (emails, banks statements etc).
- Agents update the user’s Memory Blocks.
- Agents are tasked with a mission which results in a “Card” within the user Application.
- The user reacts to the card.
- update the user’s Memory Blocks.
- Note the application is responsible for creating and managing pseudonymous IDs, bases on the [[* BBS+ Pseudonymous ID specification v1]] (which is incomplete and a work in progress).

#### A high level process diagram

Showing both

- IAB Taxonomy specific agents (and the related workflow, on the right), and
- Mission specific agents populating consumer application cards (on the left)

## 3. Core Features & User Flows

### On Boarding New Users

Without raw user data, we do not have a foundation from which to build missions that are tailored to the user's particular needs. On boarding a new user's raw data is a critical first step.

Just as important, **every onboarding step must secure on-going updates without the user's involvement**. For instance one-time CSV files or mailbox snapshots or any other workflow which captures a snapshot of data is unacceptable.
For emails, we need access to the inbox and other folders.
For bank records, we need access to a stream of transactions rather than a snapshot.
For photo's, we need access to the users photo library on an ongoing basis.
Our goal is to understand not only the user's current needs and wants, but their ongoing needs and wants, without them having to manually intervene.
Any compromise kills the app in its crib. The app store graveyard is littered with apps with grand promises who had to compromise, and ultimately lost user engagement, because walled garden APIs or scraping techniques stopped the app from getting on-going updates.

Our onboarding process makes it easy for the users to:

- sync their email accounts, including their calendars
- sync their bank accounts
- sync their Apple Health app (or the Android equivalent)
- sync their photos
- sync their location
- sync their social accounts
- sync their browsing history

### 3.3 User Memories

Our preferred Agent framework is Langgraph although we are open to alternative frameworks. Our objective is to process raw user data into classifications, further updated with user interactions, refined over time as we build an ever improving understanding of the user's Ikigai, and their needs and wants. Ultimately it results in a profile or digital twin of the user that helps the system prioritise and personalise Missions.

Some memory blocks will change infrequently, for instance the user's Demographics or Household classifications. Other blocks will update more frequently, for instance shopping interests or travel interests.

Memories can either be semantic or episodic.
Semantic memories help describe the user. Semantic memories consist of IAB Classifications and OwnYou Classifications.
Episodic memories include events including user interactions and feedback, past purchases, past data processing events and sources (emails, browsing history etc) and changes in the user's profile.
The user's profile consists of important semantic and episodic memories in a JSON format.

> [!note]
> User memory architecture is a work in progress.

### 3.2  Mission Agents

> [!important] Technical Architecture
> The detailed technical architecture for Mission Agents is specified in:
> **`docs/plans/mission_agents_architecture.md`** (Mission Agents Architecture)
>
> This includes:
> - Adaptive multi-level mission patterns (Simple, Coordinated, Complex)
> - ReAct-based persistent threads with pause/resume capability
> - Memory architecture (LangGraph Store + PostgreSQL Checkpointer)
> - Trigger system design (memory, schedule, user, external events)
> - Feedback processing (structured + natural language with LLM analysis)
> - Ikigai-driven personalization framework
> - Plugin extensibility for adding new mission types
> - Decentralization migration path

The OwnYou app is centred around user *Missions*.
Missions are prompts for user actions; actions that save the user money, actions that help the user to explore activities aligned with their Ikigai, and actions that help the user improve and optimise their health and lifespan.
Each cards includes information for specific *Missions*.
OwnYou creates specialist personal AI agents tasked to create specific missions for the user.

Personal AI Agents are open-source and will evolve over time. They leverage the user's personal data, the user's unique personal memory blocks.

#### Mission Agent hierarchy

- Savings Agents
  - Shopping Agents
  - Services Agents
  - Bill Agents
- Ikigai Agents
  - Ikigai Shopping
  - Travel Agents
  - Event Agents
    - comedy
    - theater
    - (etc)
  - Hobby Agents
  - Friend Agents
  - Restaurant Agents
  - Cooking Agents
  - Content Agents
- Health Agents
  - Diagnostic agent
  - Content agents

#### Mission Agent stories; examples of user personal agents tasked with missions:

- The user's shopping list memory block is updated to reflect the users interest in a new pair of trainers. The change in the user's shopping list memory block spurs the Shopping Agent into action. If the item is generic in nature, the agent checks various memory blocks including recent purchases, favourite colours, ethical preferences, pricing considerations and then performs a series of product searches. The results are presented to the user in a card, for the user's feedback or to prompt a purchasing action. The users reaction prompt agents to update the shopping list block and any other relevant blocks. If the items was specific then the agent's search will be specific, return optimally priced options, for the user's feedback or action.
- The Utility Bill Agent searches for the the user's utility choices before checking with the relevant utility switching service for any significantly better rate. Significance is established when the user is onboarded; i.e. only report bills that at a 10% improvement, or only report if the rate and the standing charge are more favourable.
- The user's Ikigai memory block is updated to reflect the likelihood of the user's interest in a new summer holiday in South America. The personal agent checks the user's current holiday memory block for any existing schedule holiday booking, the sporting interest memory block and historical holiday memory block and constructs ideas for Summer holiday's in south America. Three cards are created with specific holiday destinations, hotels recommendations and "things to do locally" at each destinations, aligned with the user's interests. The user reacts to the cards and the current holiday memory block is updated accordingly. Depending on the user's reaction, future agent missions are created with a more refined focus until the holiday memory block shows a holiday booking with specific dates.

> [!note]
> These examples are incomplete and represent the general user story rather than the specific implementation steps.

### 3.3 Mission Cards

Mission cards populate the main page of the consumer application.
Each card presents the user with a call to action, involving a mission created by dedicated Agents.

##### Agents create missions

Agents create missions for users based on the user's profile and memories.
For instance a Shopping Agent may see the user's profile update with a new Purchase Intent classification. The Purchase intent might be for new pair of ASIC running shoes.

##### Agent creates cards for each new mission

The Shopping Agent creates a new mission, and associated card, for a purchase of ASIC running shoes. This would involve an initial price discovery process and follow up questions for the user to help refine the ongoing search. This results in the creation of a new card for the user to react to, with a call-to-action.

##### User call-to-action

User actions include following a purchase recommendation (clicking a link to a retailer site), clarify a question posed by the agent for clarification (colour and size options, should they not be available in , simple feedback (like (snooze) / don't like).
Different missions will result in card with a different sub-set of fields and calls-to-action.

##### Agents missions have state

Each mission has a state from in-process, with updates on parameters and any results from calls-to-action, to completion once the user has dismissed the action or a final event has been completed (purchase, booking, updated service etc).

#### 3.2.1 Savings Cards/Missions

##### Description

Includes Shopping, Services and Bill agents.
Agents focused on helping the user spend money optimally.

- Shopping agents help the user purchase an item
- Services agents help the user manage their service providers including financial services and insurance providers.
- Bill agents help users optimize their ongoing bills including utility bill, phone bills etc.

##### Agent Flow: cycle_1

1. trigger event prompts agent to create a new mission. Trigger events include changes in profile, changes in purchase intent or specific user requests (find me these specific ASIC trainers for less than £100).
2. Shopping Agent (for instance), creates a new mission
3. new mission populates all available and relevant fields from memory, and select relevant call-to-action(s)
4. Agent sources image for card
5. agent creates a new mission card with key fields and image(s)
6. new mission card displayed to user

##### User Flow

1. User opens app and sees new shopping agent card
2. User follows call-to-action, for instance feedback on preferred colour(s)
3. User follows call-to-action and click on link to retailer site with featured product

##### Agent Flow: cycle_2

1. mission state updated with user action(s)
2. user memories updated with user feedback
3. Agent defines next step: snooze time, further research required

##### Data Required

- (tbd)

**Error States to Handle:**

- User do not respond to call-to-action
- Link is dead
- Image loading failures
- Network connectivity issues
- (other - tbd

#### 3.2.2 Ikigai Cards/Missions

##### Description

Ikigai is a Japanese term for "things that give you a sense of purpose in life". It's more that just an interest, it's something that acts as a source of joy and fulfilment.

Ikigai Agents includes Shopping, Travel Agent, Event Agents, Hobby Agents, Restaurant Agents and Cooking Agents.
Agents focused on helping the user spend time more optimally, including on the things that give them a sense of purpose.

- Shopping Ikigai Agents are driven by agents looking for new items the users may be interested in, not linked to any specific previous shopping experience, but rather what has been revealed by their Ikigai.
- Travel agents help the user explore new destinations with complete recommendations on hotels, flights and local attractions and opportunities. Effectively a personalized travel agent that is on the lookout for new destination the user might enjoy. It take into consideration Demographic and Household classifications, acknowledging any age or family requirements. Its take into consideration OwnYou classifications that suggest historical holiday preferences (beaches, skiing, walking, city-breaks etc).
- Event Agents look out for local events that might interest the user including theatre showings, films of possible interest with good reviews and local cinema listings, local comedy nights etc. The agent will consider OwnYou classifications on event preferences, and any relevant semantic memories, including IAB classifications as well as episodic memories of successful previously attended events.
- Hobby Agents help the user explore opportunity to develop any hobbies. The Agent will take into consideration semantic memories, including OwnYou and IAB classifications.
- Restaurant Agents are similar to Event agents but they focus on local restaurants, deals, new reviews etc. They will take into consideration Semantic and Episodic memories.
- Cooking Agents suggest new recipes based largely on semantic memories and episodic memories including successful restaurant visits, recent travel destinations etc.

##### Agent Flow: cycle_1

1. trigger event prompts agent to create a new mission. Trigger events include changes in profile, changes in episodic memories (recently travelled to Italy on holiday > Italian recipe suggestions from cooking agent).
2. Cooking Agent (for instance), creates a new mission
3. new mission populates all available and relevant fields from memory, and select relevant call-to-action(s)
4. Agent sources image for card
5. agent creates a new mission card with key fields and image(s)
6. new mission card displayed to user

##### User Flow

1. User opens app and sees new shopping agent card
2. User follows call-to-action, for instance feedback on recipe
3. User follows call-to-action and click on link to restaurant booking site with featured restaurant recommendation

##### Agent Flow: cycle_2

1. mission state updated with user action(s)
2. user memories updated with user feedback
3. Agent defines next step: snooze time, further research required

##### Data Required

- (tbd)

##### Error States to Handle

- User do not respond to call-to-action
- Link is dead
- Image loading failures
- Network connectivity issues
- (other - tbd

### 3.2.3 Health Cards/Missions

##### Description

To be finalized but a few ideas:

1. Diagnostic Agent - user input symptoms, contributing additional information overtime and Diagmostic agents builds a profile with possible conditions.
2. Fitness Agent - user inputs requirements and agent suggests lifestyle changes and opportunities to act; exercises etc

##### Agent Flow: cycle_1

1. trigger event prompts agent to create a new mission. Trigger events include changes in profile, or changes in memories.
2. Health Agent, creates a new mission
3. new mission populates all available and relevant fields from memory, and select relevant call-to-action(s)
4. Agent sources image for card
5. agent creates a new mission card with key fields and image(s)
6. new mission card displayed to user

##### User Flow

1. User opens app and sees new health card
2. User follows call-to-action

##### Agent Flow: cycle_2

1. mission state updated with user action(s)
2. user memories updated with user feedback
3. Agent defines next step: snooze time, further research required

##### Data Required

- (tbd)

##### Error States to Handle

- User do not respond to call-to-action
- Link is dead
- Image loading failures
- Network connectivity issues
- (other - tbd

### 3.1 Navigation

#### 3.1.1 Main Navigation

Four main sections/tabs; All, Savings, Ikigai and Health.
"All" includes all cards. Savings, Ikigai and health are filtered by relevant topic:

- Savings shows only the savings cards
- Ikigai shows only the Ikigai cards
- Health shows only the Ikigai cards

Savings, Ikigai and Health are all sub-sets of All.

#### 3.1.2 Floating Navigation

- Missions
- Wallet
- Notifications
- Connections
- Settings

#### 3.1.3  Missions Page

The missions page displays all the missions in a simple format allowing the user to like to dislike missions quickly, providing feedback to the respective Agents.

#### 3.1.4 Wallet Page

- Token balances
- Rewards total (by period)
- Transactions

#### 3.1.5 Notifications

Mission updates - scrollable

#### 3.1.5 Connections

Data source connections page

#### 3.1.6 Settings

Settings page

---

## 4. Business Logic & Algorithms

### 4.1 Savings Calculation

**How savings are calculated:**

For Energy:

- Fetch user's current annual cost: £1,200
- Get best available tariff for their usage: £1,141.53
- Calculate difference: £58.47
- Apply confidence factor based on data quality (0.95 for estimates)
- Show range if uncertain: "Save £45-65 per year"

For Shopping:

- Track original price when user first views
- Compare with current price
- Factor in cashback/rewards if applicable
- Include delivery costs in calculation
- Show total saved if buying bundle vs individual -->

**Example Calculation:**

```
Current cost: £___
New cost: £___
Annual savings: £___
```

Current energy cost: £100/month × 12 = £1,200/year
Best alternative: £95/month × 12 = £1,140/year
Gross savings: £60/year
Switching incentive: -£50 credit
Net first-year savings: £110
Ongoing annual savings: £60

> [!note]
> This is a placeholder.
> Update with all required calculations.

> [!important]
> Full specifications for IAB Classifier, which will be extended to include OwnYou classifications, can be found in the email_parser repository.
> In particular, the Classification.md document in the /docs folder (check for the latest version).

---

## 5. Third Party Data Sources & APIs

<!-- IMPORTANT: Specify rate limits, authentication methods, and data refresh frequencies -->

### 5.1 PLAID

> [!warning]
> This development guideline was the result of a Gemini 2.5 Pro Deep Research process.
> This would be pioneering work, which is not ideal.
> We should consider whether there are any use cases of PLAID integrations with decentralized compute networks

#### **Phase 1: One-Time Developer Setup**

This phase involves writing and deploying the core components of the system.
A development environment with Node.js, NPM, and a Solidity development framework like Hardhat or Foundry are required.

**1. Write the Chainlink Function (JavaScript)**
This is the serverless code that the Decentralized Oracle Network (DON) will execute. Its sole purpose is to perform the secure token exchange.

- **File:** `plaid-token-exchange.js`
- **Logic:**
  1. The function will receive arguments from the smart contract, specifically the `public_token` from Plaid and the user's public encryption key.  
  2. It will securely access your Plaid `client_id` and `secret` from the `secrets` object, which is provided by the DON at runtime.
  3. Using the `Functions.makeHttpRequest` helper, it will make a secure POST request to Plaid's `/item/public_token/exchange` endpoint.
  4. Upon receiving the `access_token` in the API response, it will immediately encrypt the token using the user's public key that was passed in as an argument.
  5. The function must return the encrypted `access_token` as a bytes buffer, using a helper like `Functions.encodeString()`.  

**2. Write and Deploy the Consumer Smart Contract (Solidity)**
This contract is deployed on-chain and acts as the trigger and callback handler for the Chainlink Function.

- **File:** `PlaidConsumer.sol`
- **Inheritance:** The contract must inherit from `FunctionsClient` to interact with the Chainlink Functions protocol.  
- **Key Functions:**
  - `constructor(address router)`: Sets the address of the Chainlink router for your chosen network upon deployment.
  - `executeRequest(string memory publicToken, bytes memory userPublicKey)`:
    - This public function will be called by your dApp's frontend.
    - It uses the `FunctionsRequest` library to build a request, specifying the JavaScript source code, the location of your DON-hosted encrypted secrets (`slotId` and `version`), and the `publicToken` and `userPublicKey` as arguments (`args`).  
    - It sends the finalized request to the DON by calling `_sendRequest`.
  - `fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err)`:
    - This is the internal callback function that the DON invokes after execution.  
    - The `response` parameter will contain the encrypted `access_token` returned from your JavaScript function.
    - The function should emit an event (e.g., `TokenExchangeSuccessful(address user, bytes encryptedAccessToken)`) that the frontend can subscribe to.

**3. Configure On-Chain and DON Resources**
This involves setting up your Chainlink Functions account and linking it to your smart contract.

1. **Create a Subscription:** Navigate to the [Chainlink Functions UI](https://functions.chain.link), create a new subscription, and fund it with LINK tokens.
2. **Deploy the Contract:** Deploy your `PlaidConsumer.sol` contract to a supported blockchain network (e.g., Polygon, Arbitrum).
3. **Authorize Consumer:** In the Chainlink Functions UI, add your deployed contract's address as an authorized consumer for your subscription.
4. **Upload Secrets:** Using the `@chainlink/env-enc` or a similar tool, create an encrypted secrets object containing your Plaid `client_id` and `secret`. Upload this to the DON, which will provide a `slotId` and `version` to reference in your smart contract

#### **Phase 2: The Live User Flow (First-Time Connection)**

This is the sequence of events handled by your dApp's frontend when a user connects their bank account for the first time.

1. **Initiate Plaid Link:** The user clicks "Connect Bank." Your frontend launches the Plaid Link component.
2. **Receive Public Token:** Upon successful user authentication, the Plaid Link `onSuccess` callback will provide a temporary `public_token` to your frontend application.
3. **Prepare On-Chain Request:** The frontend must obtain the user's public encryption key. This can be derived from their wallet or a signature.
4. **User Signs Transaction:** The frontend, using a library like ethers.js, constructs and prompts the user to sign a transaction. This transaction calls the `executeRequest` function on your deployed `PlaidConsumer.sol` contract, passing the `public_token` and the user's public key as arguments.
5. **Listen for Event:** The frontend must subscribe to the `TokenExchangeSuccessful` event from your smart contract.
6. **Store Encrypted Token:** When the event is received, the frontend will capture the encrypted `access_token`. This encrypted data should then be stored in a user-controlled location, such as a data stream on the Ceramic Network.

#### **Phase 3: Subsequent Data Pulls**

This flow occurs whenever the user wants to refresh their financial data. This process is handled entirely on the client-side and **does not** involve the DON or the blockchain.

1. **User Action:** The user initiates a data refresh within the dApp (e.g., clicks "Refresh Transactions").
2. **Retrieve Encrypted Token:** The frontend reads the stored encrypted `access_token` from its user-sovereign storage location (e.g., Ceramic).
3. **Client-Side Decryption:** The frontend prompts the user for a signature from their wallet. This signature is used to derive the private key needed to decrypt the `access_token`. **This decryption must happen client-side and in-memory only.** The plaintext token should never be persisted.
4. **Direct API Call to Plaid:** With the decrypted `access_token` held in a variable, the frontend makes a direct, secure HTTPS request from the browser to the relevant Plaid API endpoint (e.g., `/transactions/get`), including the `access_token` for authorization.
5. **Render Data:** Plaid's API returns the user's financial data directly to the frontend, which can then be rendered in the UI. The in-memory `access_token` variable should be cleared after the request is complete.

### 5.1 Data Sources

Public API resources

- https://publicapis.dev/category/shopping
- https://rapidapi.com/hub

API Documentation via context7
https://context7.com/websites/rapidapi/llms.txt

#### 5.1.1 Shopping/Deal APIs

**Sources:**

- Google shopping API (SerpAPI) - https://serpapi.com/google-shopping-light-api
- Google shopping API (SearchAPI, 100 free searches) - https://www.searchapi.io/docs/google-shopping
- Amazon domain specific searches (Traject Data - ASIN Rainforest API) - https://docs.trajectdata.com/rainforestapi/product-data-api/overview
- Scale AERP
- PriceRunner API (Klarna) - one month trial available but prohibitively expensive (Eur1,500 a month for 300 daily requests up to Eur6,500 for unlimited requests). Works at scale but not to start.

#### 5.1.2 Travel Data APIs

**Sources:**

- Tripadvisor API  - https://tripadvisor-content-api.readme.io/reference/overview
  - Required Credentials: we have an API key
  - restrictions - the key is domain restricted - *how do we make that work on a decentralized basis*
- Google Hotels via SearchAPI - https://www.searchapi.io/docs/google-hotels-api

#### 5.1.3 Event APIs

**Source:**
Data Thistle for Events - https://api.datathistle.com, https://api.datathistle.com/account

- Required Credentials: Tokens Available (we have already registered)
- 1000 requests allowed per month

#### 5.1.4 Restaurant APIs

**Source:**

- Tripadvisor API  - https://tripadvisor-content-api.readme.io/reference/overview
  - Required Credentials: we have an API key
  - restrictions - the key is domain restricted - *how do we make that work on a decentralized basis*

#### 5.1.5 Cooking APIs

**Sources:**

- The Meal DB -  https://www.themealdb.com/api.php
- Required Credentials: API key required

#### 5.1.6 Images

**Sources:**

- Google Images via SearchAPI - https://www.searchapi.io/docs/google-images

### 5.3 User Data Storage

**What data is stored about users:**
OwnYou does not store or process user data.
All data is stored and processed by the individual using third party secure inference, for the individual, with their permission.
OwnYou must never store any user data, of any kind.
Ideally, we would like to balance on device storage with decentralized storage but, for the MVP, we may need to optimize for cost.

---

## 6. User Authentication & Accounts

### 6.1 Authentication Method

- [ ] Email/Password
- [ ] Social login (Google, Facebook, Apple)
- [ ] Phone number with OTP
- [ ] Biometric (fingerprint, Face ID)
- [ ] Magic link (passwordless)
- [ ] Other: ___________

Consider implementing social login + email as backup
Consider: Apple Sign In mandatory for iOS if offering social login
Benefits: Faster onboarding, fewer forgotten passwords

==Use the Claude Authentication skill to design OwnYou Consumer App Authentication.==

### 6.2 User Roles

All users use OwnYou for free.
Services are paid for by the advertising workflow.

### 6.3 Consumer Application Features

All features can be managed from dedicated pages, access via the floating menu bar.

![](../attachments/Pasted%20image%2020251028162606.png)

(from left to right)

- Mission management
  - results of Mission Agents
  - one concise line per card for user feedback and processing
- Digital Wallet
  - Token Balances
  - Rewards from tracking
  - Transaction history
- Notifications
  - stream of which companies have requested tracking
  - where tracking is on going and how much has been earned
  - where tracking is complete
  - opportunity to end tracking
- Connections
  - Adding new raw data sources
- Settings
  - consumer application settings
  - disclosure settings
  - authentication settings

---

## 7. Notifications & Communications

### 7.1 Push Notifications

**Types of notifications:**

- [ ] Deal alerts (when matching user preferences)
- [ ] Price drops (on saved items)
- [ ] Expiring deals (24hr warning)
- [ ] Savings milestones (celebrate achievements)
- [ ] Energy switch reminders (contract ending)
- [ ] Weekly savings summary
- [ ] Other: ___________

**Notification Rules:**
Prevent spam!

- Max 3 per day
- Quiet hour can be set, defaulting to 9pm-8am
- Batch similar notifications
- Priority scoring for relevance
- Opt-in by category required

---

## 8. Technical Requirements

### 8.1 Performance Requirements

*To be determined.*

- **App launch time:** [Target in seconds]
  <!-- Cold start: <3 seconds, Warm start: <1 second -->
- **Screen load time:** [Target]
  <!-- <2 seconds on 4G, <4 seconds on 3G -->
- **API response time:** [Target]
  <!-- 95th percentile <500ms -->
- **Offline functionality:** [What works offline?]
  <!-- View saved deals, cached data for 24hrs, queue actions for sync -->
- **Battery usage:** [Acceptable drain]
  <!-- <5% per hour active use -->
- **Storage requirements:** [App size limits]
  <!-- Initial: <50MB, With cache: <200MB -->

### 8.2 Security Requirements

*To be expanded.*

- [ ] User data encryption (AES-256 minimum)
- [ ] Secure payment processing (PCI compliance if applicable)
- [ ] API security (HTTPS only, certificate pinning)
- [ ] GDPR compliance (consent, deletion, portability)
- [ ] Secure storage of tokens (Keychain/Keystore)
- [ ] Biometric authentication for sensitive actions
- [ ] Rate limiting on all APIs
- [ ] Input validation and sanitization
- [ ] Regular security audits
- [ ] Other regulations: ___________

**Data Protection Measures:**
Specific implementations:

- API keys never in client code
- User tokens expire after 30 days
- Sensitive data masked in logs
- PII encrypted at rest
- Audit log for data access

### 8.3 Scalability

**Expected user base:**

- Launch: 1,000 users
- 6 months: 10,000 users
- 1 year: 100,000 users
- Peak concurrent: 10% of total

**Geographic regions:**
Considering:

- Launch: UK only
- Phase 2: Ireland
- Phase 3: US
- Implications: Currency, language, regulations, data residency

---

## 9. Monetization Strategy

**Revenue Model:**
Ad revenue: £0.02-0.05 per daily active tracking relationship.
E.g.

- 10 active tracking per user per day, 100,000 users = US$7.5m
- 20 active tracking per user per day, 25m users = US$3.6bn to US$9.125bn

**Payment Integration Requirements:**
100% blockchain enabled.

---

## 10. Design & UX Specifications

### 10.1 Figma Files

**File links:**
https://www.figma.com/proto/uslNpFN9c097hmsNRcKhZl/OwnYou--May-25-mockup?node-id=0-1&t=myiCUq9I2sY1GBLs-1

### 10.2 Design System

- **Primary colors:** [Hex codes]
  - Primary: #87CEEB,
  - Secondary: #70DF82,
  - Tertiary: #E91312
- **Secondary colors:**
  - #FFFFFF
  - #000000
- **Typography:** [Font families and sizes]
  Life Savers
- **Icon style:** [Description]
  - custom icons
- **Button styles:** [Description]
  - Rounded corners
- **Layout system:** [8px grid, 4px for small elements]
  - dual column cards for mobile app
  - multiple column cards for desktop app
- **Animation style:**
  - Subtle

![](../attachments/Pasted%20image%2020251028163651.png)

### 10.3 Figma Screenshots

*Screenshots provide examples and not an complete set of requirements.*

#### 10.3.1 Homepage

![](../attachments/Pasted%20image%2020251028165212.png)

#### 10.3.2 Cards

10.3.2.1 card_savings_shopping
![](../attachments/Pasted%20image%2020251028165305.png)

10.3.2.2 card_savings_utility
![](../attachments/Pasted%20image%2020251028165405.png)

10.3.2.3 card_ikigai_shopping
![](../attachments/Pasted%20image%2020251028165808.png)

10.3.2.4 card_ikigai_travel
![](../attachments/Pasted%20image%2020251028165843.png)

10.3.2.5 card_ikigai_content
![](../attachments/Pasted%20image%2020251028165906.png)

10.3.2.2 card_ikigai_food_recipe
![](../attachments/Pasted%20image%2020251028165926.png)

10.3.2.2 card_ikigai_event_comedy
![](../attachments/Pasted%20image%2020251028165948.png)

10.3.2.2 card_ikigai_event_theater
![](../attachments/Pasted%20image%2020251028170001.png)

### 10.4 Responsive Design

- [ ] Mobile-first
- [ ] Tablet support
- [ ] Different screen sizes needed

**Breakpoints:**
Standard breakpoints:

- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+ (if web app)

---

## 11. Testing Requirements

### 11.1 Testing Strategy

- [ ] Unit testing (target: 80% code coverage)
- [ ] Integration testing (API endpoints, data flow)
- [ ] User acceptance testing (recruit 20-50 beta testers)
- [ ] Performance testing (load testing with 1000+ concurrent users)
- [ ] Security testing (penetration testing, OWASP top 10)
- [ ] Accessibility testing (WCAG 2.1 Level AA compliance)
- [ ] Localization testing (if multi-language)

**Testing Tools:**
Suggestions (*to be confirmed*):

- Unit: Jest, React Native Testing Library
- E2E: Detox, Appium
- Performance: Apache JMeter, K6
- Monitoring: Sentry, Crashlytics

### 11.2 Device Testing

**Minimum supported versions:**

- iOS: iOS 13+ recommended (covers 95%+ of users)
- Android: Android 8+ (API 26) recommended

**Critical devices to test:**

- iPhone: 12, 13, 14, SE
- Android: Samsung Galaxy S series, Google Pixel
- Tablets: iPad, Samsung Tab (if supporting)
- Various screen sizes: 5.5", 6.1", 6.7"

---

## 12. Launch & Deployment

### 12.1 App Store Requirements

- [ ] iOS App Store
  <!-- Requirements: Apple Developer Account ($99/year), app review (1-7 days) -->
- [ ] Google Play Store
  <!-- Requirements: Google Play Console ($25 one-time), review (2-24 hours) -->
- [ ] Other platforms: ___________
  - *to be discovered*

**Store Listing Assets Needed:**
*To be completed:*

- App name (30 chars max)
- Subtitle/short description (80 chars)
- Description (4000 chars)
- Keywords (100 chars for iOS)
- Screenshots (6.5", 5.5" for iOS; various for Android)
- App preview video (optional but recommended)
- App icon (1024x1024px)
- Feature graphic (Android: 1024x500px)
- Privacy policy URL
- Support URL
- Age rating questionnaire

### 12.2 Go-Live Timeline

**Target launch date:** March 2026.

**Pre-launch milestones:**

<!-- EXAMPLE TIMELINE:
1. [Week 1-2] - Core features development
2. [Week 3-4] - API integrations
3. [Week 5] - Internal testing
4. [Week 6] - Beta testing recruitment
5. [Week 7-8] - Beta testing & fixes
6. [Week 9] - App store submission
7. [Week 10] - Marketing preparation
8. [Launch day] - Go live & monitor -->

9. [Milestone 1] - [Date]
10. [Milestone 2] - [Date]
11. [Continue...]

---

## 13. Post-Launch Considerations

### 13.1 Analytics & Monitoring

**Key metrics to track:**

<!-- ESSENTIAL METRICS with target values -->

- [User acquisition: Daily/weekly new users]
- [Retention: Day 1, 7, 30 retention rates]
- [Engagement: DAU/MAU ratio, session length]
- [Conversion: Free to premium, deal clicks to purchases]
- [Performance: Crash rate (<1%), ANR rate]
- [User satisfaction: App store rating (target 4.5+)]
- [Business metrics: Total savings delivered, revenue per user]

**Analytics Tools:**

<!-- Recommendations:
- Google Analytics/Firebase Analytics (free)
- Mixpanel (user behavior)
- Amplitude (product analytics)
- Custom dashboard for business KPIs -->

### 13.2 Maintenance & Updates

**Update frequency:** [How often will the app be updated?]

<!-- Typical: Bug fixes weekly, features monthly, major updates quarterly -->

**Content update process:** [How will deals/content be kept current?]

<!-- Examples:
- Automated: API pulls every hour
- Manual: Daily review by content team
- Hybrid: Auto-import with manual verification
- User-generated: Community submissions with moderation -->

**Version management:**

<!-- Strategy for updates:
- Force update for critical fixes
- Optional updates for features
- Gradual rollout (start with 10% of users)
- A/B testing new features -->

---

## 14. Additional Notes

**Special considerations:**
[Any other important information for your AI coding assistant]

<!-- EXAMPLES TO CONSIDER:
- Seasonal factors (Black Friday, January energy switches)
- Regulatory changes (energy price caps, data protection)
- Competitor features to match or exceed
- Partnership requirements or restrictions
- Branding guidelines or design system constraints
- Accessibility requirements (voice over, large text)
- Localization needs (currency, date formats, languages) -->

**Known challenges:**
[Technical or business challenges you anticipate]

<!-- EXAMPLES:
- API rate limits from partners
- Real-time price accuracy
- User trust (new app in financial space)
- App store approval (financial services category)
- Competing with established players
- Monetization without annoying users -->

**Nice-to-have features:**
[Features that aren't essential for MVP but could be added later]

<!-- PRIORITIZED WISH LIST:
1. AI-powered receipt scanning
2. Family account sharing
3. Automated bill negotiation
4. Carbon footprint tracking
5. Loyalty points aggregation
6. Social features (share deals, compete on savings)
7. Voice assistant integration
8. Predictive savings (ML-based)
9. Cryptocurrency cashback
10. White-label for partners -->

**Success criteria:**

<!-- How will you know the app is successful? Be specific!
- 10,000 downloads in first 3 months
- 4.5+ app store rating
- 30% monthly active users
- £1M total user savings achieved
- Break-even within 12 months -->

---

## 15. Questions for AI Assistant

1. What's the best way to chart a course to a completely decentralized self-sovereign application, with distributed private inference and decentralized storage but still get an MVP to market quickly, and safely?
2. What's the best way to build decentralized web3 authentication for the consumer application (skill available)?
3. What's the most effective and efficient on device agent AI architecture?
4. What's the most effective and efficient way to develop and maintain a rich consumer profile that drives and learns from consumer Missions, adding layers of rich intelligence over time, with a positive reflexive loop as the user adds more raw personal data and interacts with more missions over time.

---

**Document Version:** 1.0
**Last Updated:** [Date]
**Next Review:** [Date]
