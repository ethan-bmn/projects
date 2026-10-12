export default defineAppConfig({
  ui: {
    colors: {
      primary: 'zinc',
      neutral: 'zinc'
    },
    button: {
      slots: {
        base: 'cursor-pointer rounded-md font-medium transition-colors duration-150'
      },
      variants: {
        size: {
          md: { base: 'h-9 px-3 text-sm' }
        }
      }
    },
    input: {
      slots: {
        base: 'rounded-md bg-default shadow-none'
      },
      variants: {
        size: {
          md: { base: 'h-9 px-3 text-sm' }
        }
      }
    },
    header: {
      slots: {
        root: 'static border-b border-default bg-default backdrop-blur-none'
      }
    }
  }
})
