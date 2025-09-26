export const me = async (req, res) => {
  res.json({ user: req.user });
};
