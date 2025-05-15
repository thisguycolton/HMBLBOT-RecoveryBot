# HMBLBOT RecoveryBot

**HMBLBOT RecoveryBot** is an open-source web application built with [Ruby on Rails](https://rubyonrails.org/), designed to support people in recovery and 12-step programs. It provides interactive meeting formats, searchable recovery literature, and tools for organizing and sharing content online.

> Made with ❤️ by [Colton Hagan](https://github.com/thisguycolton) as a way to give back to a community that gave him so much.

---

## ✨ Features

- 🗣 **Topicificator 9000** – Randomized topic generator for group discussions
- 📚 **Literature Library** – Searchable collection of recovery readings
- 📝 **Rich Text Editor** – Post and format meeting readings online
- 🔒 **User Authentication** – Admin approval required for new accounts
- 🎨 **Maglev CMS Integration** – Easy editing and layout customization

---

## 🚀 Getting Started

### Requirements

- Ruby 3.2+
- Rails 7
- PostgreSQL
- Node.js + Yarn (or Bun)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/thisguycolton/HMBLBOT-RecoveryBot.git
   cd HMBLBOT-RecoveryBot
   ```

2. **Install dependencies**

   ```
   bundle install
   yarn install # or bun install
   ```

3. **Setup the database**

   ```
   rails db:setup
   ```

4. Start the server

   ```
   ./bin/dev
   ```

5. Visit http://localhost:3000 to see the app running locally.

### 🔧 Configuration

    You can manage users via the Rails console:

    User.create(email: "admin@example.com", password: "password", admin: true, confirmed: true)

    Environment variables:

        RAILS_ENV – Default: development

        DATABASE_URL – If using an external DB

        REDIS_URL – Optional, for caching or background jobs

🧱 Built With

    Ruby on Rails

    MaglevCMS

    Stimulus.js

    Vite for JavaScript bundling

    CapRover for deployment

📦 Deployment

This app is production-ready and has been deployed on CapRover. You can customize Dockerfile or use CapRover’s one-click deploy option.
🤝 Contributing

Pull requests and issues are welcome! If you find a bug or have a suggestion, open an issue or submit a PR.
📜 License

MIT
🙌 Acknowledgements

Thanks to the recovery community and all the open-source tools that made this project possible.
