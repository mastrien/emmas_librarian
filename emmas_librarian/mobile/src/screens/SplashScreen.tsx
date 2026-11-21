import React from 'react';

/**
 * The opening screen: the logo and the name, while the library is read from the phone's storage.
 *
 * @example <SplashScreen />
 */
export const SplashScreen: React.FC = () => (
  <main className="m-splash" aria-label="Abrindo o Emma's Librarian">
    <div className="m-splash__logo">
      <img src="./logo.svg" alt="Logo do Emma's Librarian" width={116} height={116} />
    </div>
    <h1 className="m-splash__name">Emma&apos;s Librarian</h1>
    <p className="m-splash__tagline">Sua biblioteca de pesquisa</p>
    <p className="m-splash__status" role="status">
      Abrindo a biblioteca…
    </p>
  </main>
);
