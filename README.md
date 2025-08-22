fitbounty/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json
├── src/
│   ├── bot/
│   │   ├── index.js                 # Main bot entry point
│   │   ├── nostr-client.js          # NOSTR connection & event handling
│   │   ├── message-parser.js        # NLP/regex for natural language
│   │   ├── challenge-handler.js     # Challenge creation & management
│   │   ├── payment-handler.js       # Lightning payments & escrow
│   │   └── video-verifier.js        # MediaPipe integration
│   ├── database/
│   │   ├── db.js                    # Database connection
│   │   ├── models/
│   │   │   ├── challenge.js         # Challenge schema
│   │   │   ├── bounty.js           # Bounty schema
│   │   │   └── user.js             # User schema
│   │   └── migrations/
│   │       └── 001_initial.sql
│   ├── utils/
│   │   ├── logger.js               # Logging utility
│   │   ├── crypto.js               # Key management
│   │   └── constants.js            # App constants
│   └── web/
│       ├── server.js               # Optional web dashboard
│       ├── public/
│       └── views/
├── scripts/
│   ├── setup.sh                    # Environment setup
│   ├── generate-keys.js            # NOSTR key generation
│   └── deploy-umbrel.sh            # Umbrel deployment
├── mediapipe/
│   ├── models/                     # Exercise classification models
│   ├── exercise-detector.py        # Python MediaPipe service
│   ├── requirements.txt
│   └── Dockerfile
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│       └── sample-videos/
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── NOSTR-PROTOCOL.md
└── umbrel/
    ├── docker-compose.umbrel.yml
    ├── umbrel-app.yml
    └── .env.umbrel