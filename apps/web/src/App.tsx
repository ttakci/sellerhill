import { BrowserRouter } from 'react-router-dom';

import { ExamplesPageContainer } from './features/examples/ExamplesPage.container';
import { AppLayout } from './layouts/AppLayout';

export function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <ExamplesPageContainer />
      </AppLayout>
    </BrowserRouter>
  );
}
