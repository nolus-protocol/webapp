export function setupWallet() {
    cy.setupWallet({
        secretWords: Cypress.env('secretWords'),
    }).then((taskCompleted) => {
        expect(taskCompleted).to.be.true;
    });
}

export function acceptAccessForKeplr() {
    cy.get('[data-cy="connect-wallet-button"]').click();
    cy.contains('Keplr').click();
    cy.acceptAccess().then((taskCompleted) => {
        expect(taskCompleted).to.be.true;
    });
}