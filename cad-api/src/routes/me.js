import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    discord_id: req.user.discord_id,
    discord_name: req.user.discord_name,
    avatar: req.user.avatar,
    groups: req.user.groups || [],
    perms: req.user.perms || {},
    role_names: req.user.role_names || [],
  });
});

export default router;
