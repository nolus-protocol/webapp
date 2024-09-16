import { setupWallet, acceptAccessForKeplr } from '../utils/wallet.js';

describe('OpenPosition tests', () => {

    before(() => {
        setupWallet();
    });

    it('open position', () => {
        cy.visit('/lease')
        acceptAccessForKeplr();

        // Click "Lease New"
        cy.get('[data-cy="lease-new-button"]').click()

        // Select dp currency
        cy.get('[data-cy="dp-currency-dropdown"]').click();
        cy.get('[data-cy="dp-currency-dropdown"]')
            .find('li')
            .find('img[src="https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/neutron-usdc.svg"]')
            .parents('li')
            .click();

        // Enter dp amount
        cy.get('[data-cy="dp-amount-text-field"]')
            .clear()
        cy.get('[data-cy="dp-amount-text-field"]')
            .type('0.1')

        // Select lease currency
        cy.get('[data-cy="lease-currency-dropdown"]').click();
        cy.get('[data-cy="lease-currency-dropdown"]').contains('NTRN').click();

        // TO DO: Drag the RangeComponent
        // cy.get('[data-cy="lease-range-component"]').then(($range) => {
        //     const width = $range.width(); // Get the width of the range slider

        //     if (width === undefined) {
        //         throw new Error('Range slider width is undefined');
        //     }

        //     const x = 20; // Set the slider to 50% of its width (adjust "50" as needed)
        //     console.log(x)
        //     // Simulate the drag action
        //     cy.wrap($range)
        //         .trigger('mousedown', { which: 1, pageX: 0, clientX: 0 })
        //     cy.wrap($range)
        //         .trigger('mousemove', { which: 1, pageX: x, clientX: x })
        //     // cy.wrap($range)
        //     //     .trigger('mouseup', { force: true });
        // });

        // cy.get('.text-right').contains('$500');

        // TO DO: Validate lease info

        // Open
        // Click "Open Position"
        cy.get('[data-cy="open-position-button"]')
            .click()

        cy.get('[data-cy="amount-warning"]')
            .click()

        cy.confirmTransaction().then((taskCompleted) => {
            expect(taskCompleted).to.be.true;
        });

        // TO DO: Check the result
    })
})