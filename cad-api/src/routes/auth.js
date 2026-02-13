import express from 'express';
import { exchangeCodeForToken, getDiscordUser } from '../lib/discord.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../lib/auth.js';

const router = express.Router();

router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get('/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');

    const token = await exchangeCodeForToken(code);
    const user = await getDiscordUser(token.access_token);

    const jwtPayload = {
      discord_id: user.id,
      discord_name: `${user.username}${user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : ''}`,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
    };

    const jwt = signToken(jwtPayload);
    setAuthCookie(res, jwt);

    // Return to CAD portal
    res.redirect(`${process.env.WEB_ORIGIN}/cad/`);
  } catch (e) {
    res.status(500).send('Auth failed');
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
