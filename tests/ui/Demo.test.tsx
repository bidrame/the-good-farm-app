import { render, screen } from '@testing-library/react'
import { Demo } from '../../src/demo'

describe('mode démonstration', () => {
  it('affiche l’accueil avec des données d’exemple', () => {
    render(<Demo />)
    expect(screen.getByRole('heading', { name: /The Good Farm/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Stock par calibre')).toHaveTextContent('Gros')
  })
})
