import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Export } from '../../src/ui/pages/Export'
import { DonneesFixes } from '../../src/data/useDonnees'
import { ferme } from '../fixtures/ferme'

describe('Export', () => {
  it('partage le fichier et note la date de sauvegarde', async () => {
    const share = vi.fn(async () => {})
    Object.assign(navigator, { share, canShare: () => true })
    const enregistrer = vi.fn(async () => 'x')
    render(<DonneesFixes donnees={ferme()} actions={{ enregistrer }}><Export /></DonneesFixes>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Exporter et partager' }))
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }))
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].name).toMatch(/^TheGoodFarm_\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(enregistrer).toHaveBeenCalledWith('reglages', expect.objectContaining({ id: 1, derniere_sauvegarde: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }))
    expect(screen.getByText(/Sauvegarde faite/)).toBeInTheDocument()
  })
})
