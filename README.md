# JEFTECH website and AI chat

## Run locally

Requires Node.js 20.6 or later. The website itself runs without third-party packages. To run the site and AI chat locally:

```sh
cp .env.example .env
# Add your private OpenAI API key to .env
npm start
```

Open [http://localhost:3000](http://localhost:3000). `.env` is excluded from version control. Never put the API key in `index.html`, `chat.js`, or any other browser file, and never publish or share the `.env` file. You can optionally choose a different Chat Completions model with `OPENAI_MODEL`; the default is `gpt-4o-mini`. Set `PORT` if your host assigns a different port.

You can also preview the website without Node.js by opening `index.html/index.html` directly. The chat widget will answer common company, service, contact, and safety questions with clearly labelled quick replies. Full AI answers require the Node.js server and API key.

Run `npm run check` to check the JavaScript syntax before deployment.

## Publish with Render

The included `render.yaml` is a Render Blueprint for the website and chat server. It uses Render's free web-service plan to get started; free services can spin down while idle, so choose an always-on plan in Render if you need consistently fast responses. OpenAI API usage is billed separately to the account that owns the API key.

1. Create a GitHub repository for this project and upload the project files while keeping the `index.html/` folder intact. Do not upload `.env`, API keys, or other secrets.
2. In Render, select **New > Blueprint**, connect the GitHub repository, and select the included `render.yaml`. During setup, enter your private `OPENAI_API_KEY` when Render requests it. The model is set to `gpt-4o-mini`.
3. Wait for the deploy to finish. Render supplies an `onrender.com` URL; open it and test the site. Visit `/healthz` and verify the response contains `"aiConfigured":true`.
4. To use your own domain, buy one from a registrar, then add it in the Render service's **Settings > Custom Domains**. Copy the DNS records Render displays into your domain registrar's DNS settings, remove conflicting `AAAA` records if Render instructs you to, then verify the domain in Render. Render documents custom-domain DNS steps [here](https://render.com/docs/custom-domains).
5. Check `https://YOUR-DOMAIN/robots.txt` and `https://YOUR-DOMAIN/sitemap.xml`.
6. Add the domain property in Google Search Console, verify domain ownership by adding the DNS TXT record Google supplies, and submit `https://YOUR-DOMAIN/sitemap.xml`. Google's documentation: [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

The `onrender.com` URL makes the site publicly reachable before you buy a custom domain. Search indexing is controlled by Google and can take time; submission does not guarantee a particular ranking or timing.

The API key and model are never sent to website visitors. The chat endpoint applies request size, message-count, and per-IP rate limits.

After deployment, visit `/healthz` to confirm the server is running and see whether AI is configured. OpenAI API usage is billed to the account that owns the configured key. The chat assistant is set up to respond to client enquiries, provide the registered Owerri address when asked about the company's location, ask a relevant project follow-up, and direct clients to the company by phone or email. It only has the company information published on this website; it cannot confirm prices, appointments, or details that have not been provided by the company.

## Contact and deployment checklist

- Set `OPENAI_API_KEY` as a secret environment variable on the Node.js host; never add it to website files or commit `.env`.
- Deploy the contents of this folder together, preserving the `index.html/` directory and including `render.yaml`.
- Confirm the deployed page loads over HTTPS, then visit `/healthz` and check that `aiConfigured` is `true`.
- Test the chat, `mailto:` links, `tel:+2347067587195` link, and WhatsApp link to `https://wa.me/2347067587195` on desktop and mobile.
- The contact form is intentionally email-based; this static site does not collect or store visitor information.
