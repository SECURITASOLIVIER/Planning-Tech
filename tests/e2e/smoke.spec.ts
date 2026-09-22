import { test,expect } from '@playwright/test'

test('login screen loads',async({page})=>{
 await page.goto('/login')
 await expect(page.getByRole('heading',{name:'Planning Securitas'})).toBeVisible()
 await expect(page.getByRole('button',{name:/Manager/})).toBeVisible()
 await expect(page.getByRole('button',{name:/Technicien/})).toBeVisible()
})
