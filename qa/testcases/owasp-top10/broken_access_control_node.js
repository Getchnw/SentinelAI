// Vulnerable access control sample
app.get('/admin/delete-user/:id', (req, res) => {
  deleteUser(req.params.id);
  res.send('ok');
});
