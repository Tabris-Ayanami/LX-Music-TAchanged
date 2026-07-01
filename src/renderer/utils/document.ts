let domTitle = document.getElementsByTagName('title')[0]

export const setTitle = (title: string | null) => {
  title ||= 'LX Music'
  domTitle.innerText = title
}
