/** Shown by <LoginCallback> when the redirect back from the identity provider cannot be completed. */
export function LoginError({ error }: { error: Error }) {
  return (
    <main className="app">
      <section className="card" data-testid="login-error">
        <h2>Sign-in failed</h2>
        <p className="alert" role="alert">
          {error.message}
        </p>
        <a href="/">Back to GameShelf</a>
      </section>
    </main>
  );
}
